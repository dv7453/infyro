from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from infyro_api.errors import ApiError
from infyro_api.security import CurrentUser, DbSession, encrypt_llm_key
from infyro_api.services import auth_service
from infyro_db.models import Agent, NotificationPrefs, TelegramLink, User
from infyro_db.settings import get_settings as load_app_settings

router = APIRouter()


class SettingsPatch(BaseModel):
    alerts_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class LlmKeysBody(BaseModel):
    agent_id: str
    llm_provider: str
    llm_api_key: str


@router.get("")
def get_settings(session: DbSession, user: CurrentUser) -> dict:
    app = load_app_settings()
    link = session.get(TelegramLink, user.id)
    prefs = session.get(NotificationPrefs, user.id)
    return {
        "phone_number": user.phone_number,
        "name": user.name,
        "email": user.email,
        "age": user.age,
        "profile_complete": bool(user.profile_complete),
        "telegram_linked": bool(link and link.chat_id),
        "chat_id": link.chat_id if link else None,
        "bot_username": app.telegram_bot_username or "InfyroMarketBot",
        "alerts_enabled": prefs.alerts_enabled if prefs else True,
        "quiet_hours_start": prefs.quiet_hours_start if prefs else None,
        "quiet_hours_end": prefs.quiet_hours_end if prefs else None,
    }


@router.patch("")
def patch_settings(body: SettingsPatch, session: DbSession, user: CurrentUser) -> dict:
    prefs = session.get(NotificationPrefs, user.id)
    if not prefs:
        prefs = NotificationPrefs(user_id=user.id, alerts_enabled=True)
        session.add(prefs)
    if body.alerts_enabled is not None:
        prefs.alerts_enabled = body.alerts_enabled
    if body.quiet_hours_start is not None:
        prefs.quiet_hours_start = body.quiet_hours_start
    if body.quiet_hours_end is not None:
        prefs.quiet_hours_end = body.quiet_hours_end
    session.commit()
    return get_settings(session, user)


@router.post("/llm-keys")
def set_llm_key(body: LlmKeysBody, session: DbSession, user: CurrentUser) -> dict:
    from uuid import UUID

    if body.llm_provider not in ("claude", "openai", "groq"):
        raise ApiError(400, "Pick Claude, OpenAI, or Groq.", "invalid_provider")
    agent = session.scalar(
        select(Agent).where(Agent.id == UUID(body.agent_id), Agent.user_id == user.id)
    )
    if not agent:
        raise ApiError(404, "That agent was not found.", "agent_not_found")
    agent.llm_provider = body.llm_provider
    agent.llm_api_key_encrypted = encrypt_llm_key(body.llm_api_key)
    session.commit()
    return {"ok": True, "has_llm_key": True}


@router.post("/link-telegram")
def link_telegram(session: DbSession, user: CurrentUser) -> dict:
    """Issue a Telegram deep link so the user can Start the bot and link chat_id."""
    return auth_service.create_telegram_link(session, user)


@router.post("/unlink-telegram")
def unlink_telegram(session: DbSession, user: CurrentUser) -> dict:
    link = session.get(TelegramLink, user.id)
    if link:
        link.chat_id = None
        link.linked_at = None
        link.pairing_token = None
        session.commit()
    return {"ok": True, "telegram_linked": False}


@router.delete("/account")
def delete_account(session: DbSession, user: CurrentUser) -> dict:
    u = session.get(User, user.id)
    if u:
        session.delete(u)
        session.commit()
    return {"ok": True}
