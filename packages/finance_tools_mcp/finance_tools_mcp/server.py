"""Finance-tools MCP — sole Postgres access path for agent harnesses."""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from infyro_db.models import (
    ActiveAgent,
    Agent,
    AgentMcpBinding,
    Alert,
    ConversationLog,
    McpCatalog,
    MemoryEntry,
    OtpCode,
    TelegramLink,
    User,
    WatchlistItem,
)
from infyro_db.session import SessionLocal

mcp = FastMCP("finance-tools")


def _session() -> Session:
    return SessionLocal()


def _json(obj: Any) -> str:
    return json.dumps(obj, default=str)


@mcp.tool()
def get_watchlist(agent_id: Optional[str] = None) -> str:
    """Return watchlist items, optionally filtered by agent_id."""
    session = _session()
    try:
        q = select(WatchlistItem)
        if agent_id:
            q = q.where(WatchlistItem.agent_id == uuid.UUID(agent_id))
        rows = session.scalars(q).all()
        return _json(
            [
                {
                    "id": str(r.id),
                    "agent_id": str(r.agent_id),
                    "instrument_symbol": r.instrument_symbol,
                    "source": r.source,
                    "threshold_pct": float(r.threshold_pct),
                    "last_price": float(r.last_price) if r.last_price is not None else None,
                }
                for r in rows
            ]
        )
    finally:
        session.close()


@mcp.tool()
def write_alert(
    agent_id: str,
    instrument_symbol: str,
    pct_change: float,
    severity: str = "info",
) -> str:
    """Persist a triggered alert for Hermes to deliver."""
    session = _session()
    try:
        alert = Alert(
            id=uuid.uuid4(),
            agent_id=uuid.UUID(agent_id),
            instrument_symbol=instrument_symbol.upper(),
            pct_change=pct_change,
            severity=severity,
            delivered=False,
        )
        session.add(alert)
        session.commit()
        return _json({"id": str(alert.id), "delivered": False})
    finally:
        session.close()


@mcp.tool()
def update_watchlist_price(watchlist_id: str, price: float) -> str:
    """Update last known price on a watchlist item after evaluation."""
    session = _session()
    try:
        item = session.get(WatchlistItem, uuid.UUID(watchlist_id))
        if not item:
            return _json({"error": "not_found"})
        item.last_price = price
        item.updated_at = datetime.now(timezone.utc)
        session.commit()
        return _json({"id": watchlist_id, "last_price": price})
    finally:
        session.close()


@mcp.tool()
def get_agent_config(agent_id: str) -> str:
    """Load agent persona, status, bindings, and provider (API key never returned)."""
    session = _session()
    try:
        agent = session.scalar(
            select(Agent)
            .options(joinedload(Agent.bindings).joinedload(AgentMcpBinding.catalog))
            .where(Agent.id == uuid.UUID(agent_id))
        )
        if not agent:
            return _json({"error": "not_found"})
        sources = [
            {
                "id": str(b.mcp_catalog_id),
                "name": b.catalog.name,
                "endpoint": b.catalog.endpoint,
                "tool_names": b.catalog.tool_names or [],
            }
            for b in agent.bindings
        ]
        return _json(
            {
                "id": str(agent.id),
                "user_id": str(agent.user_id),
                "name": agent.name,
                "avatar_color": agent.avatar_color,
                "persona": agent.persona,
                "llm_provider": agent.llm_provider,
                "has_llm_key": bool(agent.llm_api_key_encrypted),
                "status": agent.status,
                "sources": sources,
            }
        )
    finally:
        session.close()


@mcp.tool()
def get_agent_for_chat(chat_id: int) -> str:
    """Resolve the active agent for a Telegram chat_id."""
    session = _session()
    try:
        active = session.get(ActiveAgent, chat_id)
        if active:
            return get_agent_config(str(active.agent_id))
        link = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
        if not link:
            return _json({"error": "unlinked_chat"})
        agent = session.scalar(
            select(Agent)
            .where(Agent.user_id == link.user_id, Agent.status == "listening")
            .order_by(Agent.created_at.asc())
        )
        if not agent:
            return _json({"error": "no_agent"})
        session.merge(
            ActiveAgent(chat_id=chat_id, agent_id=agent.id, user_id=link.user_id)
        )
        session.commit()
        return get_agent_config(str(agent.id))
    finally:
        session.close()


@mcp.tool()
def append_memory(agent_id: str, summary_text: str, raw_pattern_json: Optional[str] = None) -> str:
    """Append a plain-language memory entry for an agent."""
    session = _session()
    try:
        pattern = json.loads(raw_pattern_json) if raw_pattern_json else None
        entry = MemoryEntry(
            id=uuid.uuid4(),
            agent_id=uuid.UUID(agent_id),
            summary_text=summary_text,
            raw_pattern_json=pattern,
        )
        session.add(entry)
        session.commit()
        return _json({"id": str(entry.id)})
    finally:
        session.close()


@mcp.tool()
def get_conversation_log(agent_id: str, limit: int = 50) -> str:
    """Return recent conversation turns for an agent."""
    session = _session()
    try:
        rows = session.scalars(
            select(ConversationLog)
            .where(ConversationLog.agent_id == uuid.UUID(agent_id))
            .order_by(ConversationLog.created_at.desc())
            .limit(limit)
        ).all()
        return _json(
            [
                {
                    "id": str(r.id),
                    "direction": r.direction,
                    "body": r.body,
                    "created_at": r.created_at.isoformat(),
                }
                for r in reversed(rows)
            ]
        )
    finally:
        session.close()


@mcp.tool()
def append_conversation(agent_id: str, direction: str, body: str) -> str:
    """Append an inbound or outbound conversation turn."""
    if direction not in ("in", "out"):
        return _json({"error": "invalid_direction"})
    session = _session()
    try:
        row = ConversationLog(
            id=uuid.uuid4(),
            agent_id=uuid.UUID(agent_id),
            direction=direction,
            body=body,
        )
        session.add(row)
        session.commit()
        return _json({"id": str(row.id)})
    finally:
        session.close()


@mcp.tool()
def upsert_otp(user_id: str, code_hash: str, expires_at_iso: str) -> str:
    """Create or replace the active OTP hash for a user."""
    session = _session()
    try:
        uid = uuid.UUID(user_id)
        for old in session.scalars(select(OtpCode).where(OtpCode.user_id == uid)).all():
            session.delete(old)
        row = OtpCode(
            id=uuid.uuid4(),
            user_id=uid,
            code_hash=code_hash,
            expires_at=datetime.fromisoformat(expires_at_iso),
            attempts=0,
        )
        session.add(row)
        session.commit()
        return _json({"id": str(row.id)})
    finally:
        session.close()


@mcp.tool()
def resolve_pairing_token(pairing_token: str, chat_id: int) -> str:
    """Link Telegram chat_id to the user behind a pairing_token and return user_id."""
    session = _session()
    try:
        link = session.scalar(
            select(TelegramLink).where(TelegramLink.pairing_token == pairing_token)
        )
        if not link:
            return _json({"error": "invalid_token"})
        link.chat_id = chat_id
        link.linked_at = datetime.now(timezone.utc)
        link.pairing_token = None
        session.commit()
        return _json({"user_id": str(link.user_id), "chat_id": chat_id})
    finally:
        session.close()


@mcp.tool()
def get_undelivered_alerts(limit: int = 20) -> str:
    """Fetch alerts not yet delivered to Telegram."""
    session = _session()
    try:
        rows = session.scalars(
            select(Alert)
            .where(Alert.delivered.is_(False))
            .order_by(Alert.created_at.asc())
            .limit(limit)
        ).all()
        out = []
        for r in rows:
            agent = session.get(Agent, r.agent_id)
            chat_id = None
            if agent:
                link = session.scalar(
                    select(TelegramLink).where(TelegramLink.user_id == agent.user_id)
                )
                chat_id = link.chat_id if link else None
            out.append(
                {
                    "id": str(r.id),
                    "agent_id": str(r.agent_id),
                    "agent_name": agent.name if agent else None,
                    "persona": agent.persona if agent else None,
                    "instrument_symbol": r.instrument_symbol,
                    "pct_change": float(r.pct_change),
                    "severity": r.severity,
                    "chat_id": chat_id,
                    "created_at": r.created_at.isoformat(),
                }
            )
        return _json(out)
    finally:
        session.close()


@mcp.tool()
def mark_alert_delivered(alert_id: str) -> str:
    """Mark an alert as delivered on Telegram."""
    session = _session()
    try:
        alert = session.get(Alert, uuid.UUID(alert_id))
        if not alert:
            return _json({"error": "not_found"})
        alert.delivered = True
        session.commit()
        return _json({"id": alert_id, "delivered": True})
    finally:
        session.close()


@mcp.tool()
def list_agents_by_user(user_id: str) -> str:
    """List agents for a user (for Telegram agent switcher)."""
    session = _session()
    try:
        rows = session.scalars(select(Agent).where(Agent.user_id == uuid.UUID(user_id))).all()
        return _json(
            [
                {"id": str(a.id), "name": a.name, "status": a.status, "avatar_color": a.avatar_color}
                for a in rows
            ]
        )
    finally:
        session.close()


@mcp.tool()
def set_active_agent(chat_id: int, agent_id: str, user_id: str) -> str:
    """Set the active agent for a Telegram chat."""
    session = _session()
    try:
        session.merge(
            ActiveAgent(
                chat_id=chat_id,
                agent_id=uuid.UUID(agent_id),
                user_id=uuid.UUID(user_id),
                updated_at=datetime.now(timezone.utc),
            )
        )
        session.commit()
        return _json({"ok": True})
    finally:
        session.close()


@mcp.tool()
def get_catalog() -> str:
    """Return the curated MCP catalog rows."""
    session = _session()
    try:
        rows = session.scalars(select(McpCatalog).order_by(McpCatalog.name)).all()
        return _json(
            [
                {
                    "id": str(r.id),
                    "name": r.name,
                    "provider": r.provider,
                    "category": r.category,
                    "description": r.description,
                    "endpoint": r.endpoint,
                    "requires_key": r.requires_key,
                    "free_tier_limit": r.free_tier_limit,
                    "tool_names": r.tool_names or [],
                }
                for r in rows
            ]
        )
    finally:
        session.close()


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
