from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from infyro_api.security import CurrentUser, DbSession
from infyro_db.models import Agent, Alert

router = APIRouter()


@router.get("")
def list_alerts(
    session: DbSession,
    user: CurrentUser,
    agent: Optional[UUID] = Query(default=None),
    instrument: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> list[dict]:
    agent_ids = select(Agent.id).where(Agent.user_id == user.id)
    stmt = select(Alert).where(Alert.agent_id.in_(agent_ids)).order_by(Alert.created_at.desc())
    if agent:
        stmt = stmt.where(Alert.agent_id == agent)
    if instrument:
        stmt = stmt.where(Alert.instrument_symbol.ilike(f"%{instrument}%"))
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if q:
        stmt = stmt.where(Alert.instrument_symbol.ilike(f"%{q}%"))
    rows = session.scalars(stmt.limit(200)).all()
    out = []
    for r in rows:
        ag = session.get(Agent, r.agent_id)
        pct = float(r.pct_change)
        out.append(
            {
                "id": str(r.id),
                "instrument_symbol": r.instrument_symbol,
                "pct_change": pct,
                "direction": "up" if pct >= 0 else "down",
                "severity": r.severity,
                "agent_id": str(r.agent_id),
                "agent_name": ag.name if ag else None,
                "agent_color": ag.avatar_color if ag else "#4F46E5",
                "delivered": r.delivered,
                "created_at": r.created_at.isoformat(),
            }
        )
    return out
