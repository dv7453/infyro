from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel

from infyro_api.errors import error_response
from infyro_api.security import CurrentUser, DbSession
from infyro_api.services import auth_service
from infyro_db.settings import get_settings

router = APIRouter()


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/phone")
async def phone(body: auth_service.PhoneRequest, session: DbSession) -> dict:
    return await auth_service.start_phone_auth(session, body.phone_number)


@router.get("/pairing-status")
async def pairing_status(phone_number: str, session: DbSession) -> dict:
    return await auth_service.pairing_status(session, phone_number)


@router.post("/verify")
def verify(body: auth_service.VerifyRequest, session: DbSession) -> dict:
    return auth_service.verify_code(session, body.phone_number, body.code)


@router.post("/resend")
async def resend(body: auth_service.ResendRequest, session: DbSession) -> dict:
    return await auth_service.resend_code(session, body.phone_number)


@router.post("/complete-profile")
def complete_profile(
    body: auth_service.ProfileCompleteRequest,
    session: DbSession,
    user: CurrentUser,
) -> dict:
    return auth_service.complete_profile(session, user, body)


@router.post("/refresh")
def refresh(body: RefreshBody, session: DbSession) -> dict:
    return auth_service.refresh_session(session, body.refresh_token)


@router.post("/dev-login")
def dev_login(session: DbSession) -> dict:
    """Local/MVP only — skipped in production when INFYRO_DEV_MODE is off."""
    return auth_service.dev_login(session)


@router.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    session: DbSession,
    x_telegram_bot_api_secret_token: Annotated[Optional[str], Header()] = None,
) -> Any:
    settings = get_settings()
    if settings.telegram_webhook_secret:
        if x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
            return error_response(403, "Webhook rejected.", "webhook_forbidden")

    payload = await request.json()
    message = payload.get("message") or payload.get("edited_message") or {}
    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return {"ok": True}

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else None
        reply = await auth_service.handle_telegram_start(session, int(chat_id), token)
        await auth_service.send_telegram_message(int(chat_id), reply)
        return {"ok": True}

    return {"ok": True, "forward": "hermes"}
