from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from infyro_db.models import McpCatalog
from infyro_db.session import SessionLocal

CATALOG_ROWS = [
    {
        "name": "CoinGecko",
        "provider": "CoinGecko",
        "category": "crypto",
        "description": "Live crypto prices, market caps, and trending coins. No key needed.",
        "endpoint": "https://mcp.api.coingecko.com/mcp",
        "requires_key": False,
        "free_tier_limit": None,
        "tool_names": [
            "get_simple_price",
            "get_coins_markets",
            "get_search_trending",
            "get_coin_by_id",
        ],
    },
    {
        "name": "Yahoo Finance",
        "provider": "Yahoo",
        "category": "stocks",
        "description": "Stock quotes and history via Yahoo Finance. No key needed.",
        "endpoint": "stdio://market-yahoo-mcp",
        "requires_key": False,
        "free_tier_limit": None,
        "tool_names": ["get_quote", "get_history", "search_ticker"],
    },
    {
        "name": "Alpha Vantage",
        "provider": "Alpha Vantage",
        "category": "stocks",
        "description": "Additional equity and forex quotes on a shared free tier.",
        "endpoint": "https://www.alphavantage.co/query",
        "requires_key": False,
        "free_tier_limit": "25 req/day",
        "tool_names": ["get_global_quote", "get_daily_adjusted"],
    },
    {
        "name": "News",
        "provider": "News search",
        "category": "news",
        "description": "Headlines and context around tickers you already watch.",
        "endpoint": "stdio://news-mcp",
        "requires_key": False,
        "free_tier_limit": None,
        "tool_names": ["search_news", "ticker_headlines"],
    },
]


def seed_catalog(session: Session) -> int:
    created = 0
    for row in CATALOG_ROWS:
        existing = session.scalar(select(McpCatalog).where(McpCatalog.name == row["name"]))
        if existing:
            for key, value in row.items():
                setattr(existing, key, value)
            continue
        session.add(McpCatalog(id=uuid.uuid4(), **row))
        created += 1
    session.commit()
    return created


def main() -> None:
    session = SessionLocal()
    try:
        n = seed_catalog(session)
        print(f"Seeded mcp_catalog ({n} new rows).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
