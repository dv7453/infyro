from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, Header
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from infyro_api.errors import ApiError
from infyro_db.models import RefreshToken, User
from infyro_db.session import get_session
from infyro_db.settings import get_settings

DbSession = Annotated[Session, Depends(get_session)]


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_otp(code: str) -> str:
    return hash_secret(code)


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_pairing_token() -> str:
    return secrets.token_urlsafe(24)


def encrypt_llm_key(plain: str) -> str:
    settings = get_settings()
    if not settings.fernet_key:
        raise ApiError(500, "Server encryption key is not configured.", "fernet_missing")
    return Fernet(settings.fernet_key.encode()).encrypt(plain.encode()).decode()


def decrypt_llm_key(token: str) -> str:
    settings = get_settings()
    try:
        return Fernet(settings.fernet_key.encode()).decrypt(token.encode()).decode()
    except (InvalidToken, ValueError) as exc:
        raise ApiError(500, "Could not decrypt stored key.", "fernet_invalid") from exc


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.jwt_access_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(session: Session, user_id: uuid.UUID) -> str:
    settings = get_settings()
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_ttl_seconds)
    session.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user_id,
            token_hash=hash_secret(raw),
            expires_at=expires,
            revoked=False,
        )
    )
    session.commit()
    return raw


def decode_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise ApiError(401, "Sign in again to continue.", "invalid_token")
        return uuid.UUID(payload["sub"])
    except (JWTError, ValueError, KeyError) as exc:
        raise ApiError(401, "Sign in again to continue.", "invalid_token") from exc


def get_current_user(
    session: DbSession,
    authorization: Annotated[Optional[str], Header()] = None,
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "Sign in again to continue.", "missing_token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_access_token(token)
    user = session.get(User, user_id)
    if not user:
        raise ApiError(401, "Sign in again to continue.", "user_missing")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
