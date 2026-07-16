from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from infyro_api.errors import ApiError
from infyro_api.security import CurrentUser, DbSession, encrypt_llm_key
from infyro_api.services import auth_service
from infyro_db.models import (
    ActiveAgent,
    Agent,
    AgentMcpBinding,
    ConversationLog,
    McpCatalog,
    MemoryEntry,
    TelegramLink,
    WatchlistItem,
)
from infyro_db.settings import get_settings
from fastapi import APIRouter

router = APIRouter()


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    avatar_color: str = "#6E5AF0"
    persona: str = ""
    llm_provider: str = "groq"
    llm_api_key: Optional[str] = None
    source_ids: list[str] = Field(default_factory=list)
    status: str = "listening"


class AgentPatch(BaseModel):
    name: Optional[str] = None
    avatar_color: Optional[str] = None
    persona: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    status: Optional[str] = None
    source_ids: Optional[list[str]] = None


class SourcesBody(BaseModel):
    source_ids: list[str]


class WatchlistBody(BaseModel):
    instrument_symbol: str
    source: str
    threshold_pct: float = 3.0


def _serialize_agent(agent: Agent) -> dict:
    return {
        "id": str(agent.id),
        "name": agent.name,
        "avatar_color": agent.avatar_color,
        "persona": agent.persona,
        "llm_provider": agent.llm_provider,
        "has_llm_key": bool(agent.llm_api_key_encrypted),
        "status": agent.status,
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
        "sources": [
            {
                "id": str(b.mcp_catalog_id),
                "name": b.catalog.name if b.catalog else None,
                "category": b.catalog.category if b.catalog else None,
                "tool_names": (b.catalog.tool_names if b.catalog else None) or [],
            }
            for b in agent.bindings
        ],
    }


def _load_agent(session: Session, agent_id: uuid.UUID, user_id: uuid.UUID) -> Agent:
    agent = session.scalar(
        select(Agent)
        .options(joinedload(Agent.bindings).joinedload(AgentMcpBinding.catalog))
        .where(Agent.id == agent_id, Agent.user_id == user_id)
    )
    if not agent:
        raise ApiError(404, "That agent was not found.", "agent_not_found")
    return agent


def _set_bindings(session: Session, agent: Agent, source_ids: list[str]) -> None:
    for b in list(agent.bindings):
        session.delete(b)
    session.flush()
    for sid in source_ids:
        cid = uuid.UUID(sid)
        cat = session.get(McpCatalog, cid)
        if not cat:
            raise ApiError(400, "One of the selected sources is not in the catalog.", "invalid_source")
        session.add(AgentMcpBinding(agent_id=agent.id, mcp_catalog_id=cid))


@router.get("")
def list_agents(session: DbSession, user: CurrentUser) -> list[dict]:
    rows = session.scalars(
        select(Agent)
        .options(joinedload(Agent.bindings).joinedload(AgentMcpBinding.catalog))
        .where(Agent.user_id == user.id)
        .order_by(Agent.created_at.desc())
    ).unique().all()
    return [_serialize_agent(a) for a in rows]


@router.post("")
def create_agent(body: AgentCreate, session: DbSession, user: CurrentUser) -> dict:
    if body.llm_provider not in ("claude", "openai", "groq"):
        raise ApiError(400, "Pick Claude, OpenAI, or Groq.", "invalid_provider")
    agent = Agent(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name.strip(),
        avatar_color=body.avatar_color,
        persona=body.persona,
        llm_provider=body.llm_provider,
        llm_api_key_encrypted=encrypt_llm_key(body.llm_api_key) if body.llm_api_key else None,
        status=body.status if body.status in ("listening", "paused") else "listening",
    )
    session.add(agent)
    session.flush()
    _set_bindings(session, agent, body.source_ids)
    session.commit()
    session.expire_all()
    return _serialize_agent(_load_agent(session, agent.id, user.id))


@router.get("/{agent_id}")
def get_agent(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> dict:
    return _serialize_agent(_load_agent(session, agent_id, user.id))


@router.patch("/{agent_id}")
def patch_agent(
    agent_id: uuid.UUID, body: AgentPatch, session: DbSession, user: CurrentUser
) -> dict:
    agent = _load_agent(session, agent_id, user.id)
    if body.name is not None:
        agent.name = body.name.strip()
    if body.avatar_color is not None:
        agent.avatar_color = body.avatar_color
    if body.persona is not None:
        agent.persona = body.persona
    if body.llm_provider is not None:
        if body.llm_provider not in ("claude", "openai", "groq"):
            raise ApiError(400, "Pick Claude, OpenAI, or Groq.", "invalid_provider")
        agent.llm_provider = body.llm_provider
    if body.llm_api_key:
        agent.llm_api_key_encrypted = encrypt_llm_key(body.llm_api_key)
    if body.status is not None:
        if body.status not in ("listening", "paused"):
            raise ApiError(400, "Status must be listening or paused.", "invalid_status")
        agent.status = body.status
    if body.source_ids is not None:
        _set_bindings(session, agent, body.source_ids)
    session.commit()
    return _serialize_agent(_load_agent(session, agent_id, user.id))


@router.delete("/{agent_id}")
def delete_agent(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> dict:
    agent = _load_agent(session, agent_id, user.id)
    session.delete(agent)
    session.commit()
    return {"ok": True}


@router.post("/{agent_id}/telegram-open")
def telegram_open(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> dict:
    """Return a t.me URL that opens the Infyro bot, pairing if needed and selecting this agent."""
    agent = _load_agent(session, agent_id, user.id)
    settings = get_settings()
    username = (settings.telegram_bot_username or "InfyroMarketBot").lstrip("@")
    link = session.get(TelegramLink, user.id)
    if not link:
        link = TelegramLink(user_id=user.id)
        session.add(link)
        session.flush()

    if not link.chat_id:
        paired = auth_service.create_telegram_link(session, user)
        return {
            "linked": False,
            "bot_username": username,
            "url": paired["deep_link"],
            "message": "Tap Start in Telegram to link this chat, then come back and press Message again.",
        }

    # Already linked — set active agent and deep-link with use_<prefix>
    session.merge(
        ActiveAgent(chat_id=int(link.chat_id), agent_id=agent.id, user_id=user.id)
    )
    session.commit()
    start = f"use_{agent.id.hex[:8]}"
    return {
        "linked": True,
        "bot_username": username,
        "url": f"https://t.me/{username}?start={start}",
        "message": f"Opening Telegram chat with {agent.name}.",
    }


@router.post("/{agent_id}/sources")
def set_sources(
    agent_id: uuid.UUID, body: SourcesBody, session: DbSession, user: CurrentUser
) -> dict:
    agent = _load_agent(session, agent_id, user.id)
    _set_bindings(session, agent, body.source_ids)
    session.commit()
    return _serialize_agent(_load_agent(session, agent_id, user.id))


@router.get("/{agent_id}/memory")
def get_memory(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> list[dict]:
    _load_agent(session, agent_id, user.id)
    rows = session.scalars(
        select(MemoryEntry)
        .where(MemoryEntry.agent_id == agent_id)
        .order_by(MemoryEntry.created_at.desc())
    ).all()
    return [
        {
            "id": str(r.id),
            "summary_text": r.summary_text,
            "raw_pattern_json": r.raw_pattern_json,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.delete("/{agent_id}/memory/{memory_id}")
def forget_memory(
    agent_id: uuid.UUID, memory_id: uuid.UUID, session: DbSession, user: CurrentUser
) -> dict:
    _load_agent(session, agent_id, user.id)
    row = session.get(MemoryEntry, memory_id)
    if not row or row.agent_id != agent_id:
        raise ApiError(404, "That memory was not found.", "memory_not_found")
    session.delete(row)
    session.commit()
    return {"ok": True}


@router.get("/{agent_id}/conversation")
def get_conversation(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> list[dict]:
    _load_agent(session, agent_id, user.id)
    rows = session.scalars(
        select(ConversationLog)
        .where(ConversationLog.agent_id == agent_id)
        .order_by(ConversationLog.created_at.asc())
        .limit(200)
    ).all()
    return [
        {
            "id": str(r.id),
            "direction": r.direction,
            "body": r.body,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{agent_id}/watchlist")
def add_watchlist(
    agent_id: uuid.UUID, body: WatchlistBody, session: DbSession, user: CurrentUser
) -> dict:
    _load_agent(session, agent_id, user.id)
    item = WatchlistItem(
        id=uuid.uuid4(),
        agent_id=agent_id,
        instrument_symbol=body.instrument_symbol.upper(),
        source=body.source,
        threshold_pct=body.threshold_pct,
    )
    session.add(item)
    session.commit()
    return {
        "id": str(item.id),
        "instrument_symbol": item.instrument_symbol,
        "source": item.source,
        "threshold_pct": float(item.threshold_pct),
    }


@router.get("/{agent_id}/watchlist")
def list_watchlist(agent_id: uuid.UUID, session: DbSession, user: CurrentUser) -> list[dict]:
    _load_agent(session, agent_id, user.id)
    rows = session.scalars(select(WatchlistItem).where(WatchlistItem.agent_id == agent_id)).all()
    return [
        {
            "id": str(r.id),
            "instrument_symbol": r.instrument_symbol,
            "source": r.source,
            "threshold_pct": float(r.threshold_pct),
            "last_price": float(r.last_price) if r.last_price is not None else None,
        }
        for r in rows
    ]
