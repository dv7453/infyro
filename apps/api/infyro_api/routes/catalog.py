from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from infyro_api.security import CurrentUser, DbSession
from infyro_db.models import McpCatalog

router = APIRouter()


@router.get("")
def list_catalog(session: DbSession, user: CurrentUser) -> list[dict]:
    rows = session.scalars(select(McpCatalog).order_by(McpCatalog.name)).all()
    return [
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
            "badge": (
                f"Free tier, {r.free_tier_limit}"
                if r.free_tier_limit
                else "Free · no key needed"
            ),
        }
        for r in rows
    ]
