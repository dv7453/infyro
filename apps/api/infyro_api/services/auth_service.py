from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from infyro_api.errors import ApiError
from infyro_api.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    generate_pairing_token,
    hash_otp,
    hash_secret,
)
from infyro_db.models import NotificationPrefs, OtpCode, RefreshToken, TelegramLink, User
from infyro_db.settings import get_settings


class PhoneRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=32)


class VerifyRequest(BaseModel):
    phone_number: str
    code: str = Field(min_length=6, max_length=6)


class ResendRequest(BaseModel):
    phone_number: str


class ProfileCompleteRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    age: int = Field(ge=13, le=120)


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if not digits.startswith("+"):
        digits = "+" + digits
    if len(digits) < 9:
        raise ApiError(400, "Enter a valid phone number with country code.", "invalid_phone")
    return digits


async def send_telegram_message(chat_id: int, text: str) -> bool:
    """Send via Infyro bot when linked. Returns False if send failed or token missing."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        print(f"[infyro] Telegram token missing; message not sent: {text[:40]}…", flush=True)
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json={"chat_id": chat_id, "text": text})
            return resp.status_code < 400
    except Exception as exc:  # noqa: BLE001
        print(f"[infyro] Telegram send failed: {exc}", flush=True)
        return False


def _recent_send_count(session: Session, user_id: uuid.UUID) -> int:
    since = datetime.now(timezone.utc) - timedelta(minutes=10)
    return session.scalar(
        select(func.count()).select_from(OtpCode).where(
            OtpCode.user_id == user_id, OtpCode.created_at >= since
        )
    ) or 0


def _create_otp(session: Session, user_id: uuid.UUID) -> str:
    if _recent_send_count(session, user_id) >= 3:
        raise ApiError(
            429,
            "Too many codes sent. Wait a few minutes before trying again.",
            "otp_rate_limited",
        )
    for old in session.scalars(select(OtpCode).where(OtpCode.user_id == user_id)).all():
        session.delete(old)
    code = generate_otp()
    session.add(
        OtpCode(
            id=uuid.uuid4(),
            user_id=user_id,
            code_hash=hash_otp(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            attempts=0,
        )
    )
    session.commit()
    return code


def get_or_create_user(session: Session, phone: str) -> User:
    user = session.scalar(select(User).where(User.phone_number == phone))
    if user:
        return user
    user = User(id=uuid.uuid4(), phone_number=phone, profile_complete=False)
    session.add(user)
    session.flush()
    session.add(TelegramLink(user_id=user.id))
    session.add(NotificationPrefs(user_id=user.id, alerts_enabled=True))
    session.commit()
    session.refresh(user)
    return user


def _user_payload(user: User, link: Optional[TelegramLink] = None) -> dict:
    return {
        "id": str(user.id),
        "phone_number": user.phone_number,
        "name": user.name,
        "email": user.email,
        "age": user.age,
        "profile_complete": bool(user.profile_complete),
        "telegram_linked": bool(link and link.chat_id),
    }


async def _deliver_otp(session: Session, user: User, code: str) -> dict:
    """Prefer Infyro Telegram bot when linked; otherwise return inline OTP for auth UI."""
    settings = get_settings()
    link = session.get(TelegramLink, user.id)
    delivered_via = "inline"
    if link and link.chat_id:
        ok = await send_telegram_message(
            link.chat_id,
            f"Your Infyro code is {code}. It expires in 5 minutes.",
        )
        if ok:
            delivered_via = "telegram"

    out = {
        "status": "code_sent",
        "phone_number": user.phone_number,
        "bot_username": settings.telegram_bot_username,
        "delivered_via": delivered_via,
        "is_returning_user": bool(user.profile_complete),
        "needs_telegram_start": False,
    }
    # Show code in the app whenever Telegram didn't deliver (no SMS provider tonight)
    if delivered_via == "inline":
        out["otp"] = code
        print(f"[infyro] OTP for {user.phone_number}: {code}", flush=True)
    return out


def _attach_telegram_deep_link(session: Session, user: User, out: dict) -> dict:
    """When Telegram isn't linked, include a BotFather deep link for pairing."""
    settings = get_settings()
    link = session.get(TelegramLink, user.id)
    if not link:
        link = TelegramLink(user_id=user.id)
        session.add(link)
        session.flush()
    if link.chat_id:
        out["needs_telegram_start"] = False
        return out
    token = generate_pairing_token()
    link.pairing_token = token
    session.commit()
    username = settings.telegram_bot_username or "InfyroMarketBot"
    out["needs_telegram_start"] = True
    out["deep_link"] = f"https://t.me/{username}?start={token}"
    return out


async def start_phone_auth(session: Session, phone_number: str) -> dict:
    phone = normalize_phone(phone_number)
    user = get_or_create_user(session, phone)
    link = session.get(TelegramLink, user.id)
    if not link:
        session.add(TelegramLink(user_id=user.id))
        session.commit()
    code = _create_otp(session, user.id)
    out = await _deliver_otp(session, user, code)
    return _attach_telegram_deep_link(session, user, out)


async def pairing_status(session: Session, phone_number: str) -> dict:
    phone = normalize_phone(phone_number)
    user = session.scalar(select(User).where(User.phone_number == phone))
    if not user:
        return {"status": "unknown", "code_sent": False, "linked": False}
    link = session.get(TelegramLink, user.id)
    latest = session.scalar(
        select(OtpCode).where(OtpCode.user_id == user.id).order_by(OtpCode.created_at.desc())
    )
    code_sent = bool(latest and latest.expires_at > datetime.now(timezone.utc))
    return {
        "status": "code_sent" if code_sent else "ready",
        "code_sent": code_sent,
        "linked": bool(link and link.chat_id),
    }


async def handle_telegram_start(
    session: Session, chat_id: int, pairing_token: Optional[str]
) -> str:
    """Link account via pairing token, or switch active agent via use_<prefix>."""
    from infyro_db.models import ActiveAgent, Agent

    # Switch watcher without re-pairing: /start use_<agentHexPrefix>
    if pairing_token and pairing_token.startswith("use_"):
        prefix = pairing_token[4:].strip()
        link = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
        if not link:
            return (
                "This Telegram chat isn't linked to Infyro yet.\n"
                "Open Settings → Link Telegram in the dashboard, then try again."
            )
        agents = session.scalars(select(Agent).where(Agent.user_id == link.user_id)).all()
        match = next((a for a in agents if a.id.hex.startswith(prefix)), None)
        if not match:
            return "Couldn't find that watcher. Open it from the dashboard and try Message on Telegram again."
        session.merge(
            ActiveAgent(chat_id=chat_id, agent_id=match.id, user_id=link.user_id)
        )
        session.commit()
        return (
            f"You're chatting with {match.name}.\n"
            "Ask about markets any time. /agents lists your watchers."
        )

    if pairing_token:
        link = session.scalar(
            select(TelegramLink).where(TelegramLink.pairing_token == pairing_token)
        )
        if link:
            link.chat_id = chat_id
            link.linked_at = datetime.now(timezone.utc)
            link.pairing_token = None
            session.commit()
            return (
                "Linked to Infyro. Codes and alerts can arrive here.\n"
                "Head back to the dashboard — Message on Telegram will open this chat."
            )

    # Bare /start — if already linked, welcome; otherwise guide to dashboard
    linked = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
    if linked:
        return (
            "Welcome back to Infyro — every market, one thread.\n"
            "Send /agents to pick a watcher, or open one from the dashboard."
        )
    return (
        "Welcome to Infyro — every market, one thread.\n\n"
        "Open Settings → Link Telegram in the web app, then tap Start with the special link."
    )


async def resend_code(session: Session, phone_number: str) -> dict:
    phone = normalize_phone(phone_number)
    user = session.scalar(select(User).where(User.phone_number == phone))
    if not user:
        raise ApiError(404, "No account found for that number.", "user_not_found")
    code = _create_otp(session, user.id)
    out = await _deliver_otp(session, user, code)
    return _attach_telegram_deep_link(session, user, out)


def create_telegram_link(session: Session, user: User) -> dict:
    settings = get_settings()
    link = session.get(TelegramLink, user.id)
    if not link:
        link = TelegramLink(user_id=user.id)
        session.add(link)
        session.flush()
    if link.chat_id:
        return {
            "telegram_linked": True,
            "bot_username": settings.telegram_bot_username,
            "deep_link": None,
        }
    token = generate_pairing_token()
    link.pairing_token = token
    session.commit()
    username = settings.telegram_bot_username or "InfyroMarketBot"
    return {
        "telegram_linked": False,
        "bot_username": username,
        "deep_link": f"https://t.me/{username}?start={token}",
    }


def verify_code(session: Session, phone_number: str, code: str) -> dict:
    phone = normalize_phone(phone_number)
    user = session.scalar(select(User).where(User.phone_number == phone))
    if not user:
        raise ApiError(404, "No account found for that number.", "user_not_found")
    otp = session.scalar(
        select(OtpCode).where(OtpCode.user_id == user.id).order_by(OtpCode.created_at.desc())
    )
    if not otp:
        raise ApiError(400, "Code expired. Send a new one.", "otp_missing")
    if otp.expires_at < datetime.now(timezone.utc):
        raise ApiError(400, "Code expired. Send a new one.", "otp_expired")
    if otp.attempts >= 3:
        raise ApiError(400, "Too many attempts. Send a new code.", "otp_locked")
    if hash_otp(code) != otp.code_hash:
        otp.attempts += 1
        session.commit()
        raise ApiError(400, "That code didn't match. Try again.", "otp_mismatch")

    session.delete(otp)
    access = create_access_token(user.id)
    refresh = create_refresh_token(session, user.id)
    link = session.get(TelegramLink, user.id)
    next_step = "dashboard" if user.profile_complete else "complete_profile"
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "next_step": next_step,
        "user": _user_payload(user, link),
    }


def complete_profile(session: Session, user: User, body: ProfileCompleteRequest) -> dict:
    email_norm = body.email.lower().strip()
    if "@" not in email_norm or "." not in email_norm.split("@")[-1]:
        raise ApiError(400, "Enter a valid email address.", "invalid_email")
    clash = session.scalar(
        select(User).where(User.email == email_norm, User.id != user.id)
    )
    if clash:
        raise ApiError(400, "That email is already in use.", "email_taken")
    user.name = body.name.strip()
    user.email = email_norm
    user.age = body.age
    user.profile_complete = True
    session.commit()
    link = session.get(TelegramLink, user.id)
    return {"user": _user_payload(user, link), "next_step": "dashboard"}


def refresh_session(session: Session, refresh_token: str) -> dict:
    th = hash_secret(refresh_token)
    row = session.scalar(select(RefreshToken).where(RefreshToken.token_hash == th))
    if not row or row.revoked or row.expires_at < datetime.now(timezone.utc):
        raise ApiError(401, "Sign in again to continue.", "refresh_invalid")
    row.revoked = True
    access = create_access_token(row.user_id)
    new_refresh = create_refresh_token(session, row.user_id)
    return {"access_token": access, "refresh_token": new_refresh, "token_type": "bearer"}


def dev_login(session: Session) -> dict:
    """MVP shortcut: mint a session for a shared local user. Gated by INFYRO_DEV_MODE."""
    settings = get_settings()
    if not settings.infyro_dev_mode:
        raise ApiError(404, "Not found.", "not_found")

    phone = "+919999000000"
    user = get_or_create_user(session, phone)
    if not user.profile_complete:
        user.name = user.name or "MVP Tester"
        user.email = user.email or "mvp@infyro.local"
        user.age = user.age or 26
        user.profile_complete = True
        session.commit()
        session.refresh(user)

    link = session.get(TelegramLink, user.id)
    access = create_access_token(user.id)
    refresh = create_refresh_token(session, user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "next_step": "dashboard",
        "user": _user_payload(user, link),
    }
