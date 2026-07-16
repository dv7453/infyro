"""Deterministic OpenClaw-role market worker — fetch, evaluate, write alerts. No Telegram, no LLM."""

from __future__ import annotations

import json
import logging
import time
import urllib.request
from typing import Any

import yfinance as yf
from sqlalchemy import select

from infyro_db.models import Alert, WatchlistItem
from infyro_db.session import SessionLocal
import uuid
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [openclaw-worker] %(message)s")
log = logging.getLogger("openclaw-worker")


def _coingecko_price(symbol: str) -> float | None:
    # Map common tickers to CoinGecko ids
    mapping = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "BTC-USD": "bitcoin",
        "ETH-USD": "ethereum",
    }
    coin_id = mapping.get(symbol.upper(), symbol.lower())
    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={coin_id}&vs_currencies=usd&include_24hr_change=true"
    )
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        row = data.get(coin_id) or {}
        price = row.get("usd")
        return float(price) if price is not None else None
    except Exception as exc:  # noqa: BLE001
        log.warning("CoinGecko failed for %s: %s", symbol, exc)
        return None


def _yahoo_quote(symbol: str) -> tuple[float | None, float | None]:
    try:
        info = yf.Ticker(symbol.upper()).fast_info
        price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
        prev = getattr(info, "previous_close", None) or getattr(info, "previousClose", None)
        return (
            float(price) if price is not None else None,
            float(prev) if prev is not None else None,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Yahoo failed for %s: %s", symbol, exc)
        return None, None


def _severity(pct: float) -> str:
    ap = abs(pct)
    if ap >= 10:
        return "critical"
    if ap >= 5:
        return "high"
    return "info"


def evaluate_once() -> int:
    session = SessionLocal()
    written = 0
    try:
        items = session.scalars(select(WatchlistItem)).all()
        for item in items:
            price: float | None = None
            pct: float | None = None
            if item.source.lower() in ("coingecko", "crypto") or item.instrument_symbol.upper() in (
                "BTC",
                "ETH",
                "SOL",
            ):
                price = _coingecko_price(item.instrument_symbol)
                if price is not None and item.last_price:
                    pct = ((price - float(item.last_price)) / float(item.last_price)) * 100.0
                elif price is not None:
                    # first observation — store baseline, no alert
                    pct = 0.0
            else:
                price, prev = _yahoo_quote(item.instrument_symbol)
                if price is not None and prev:
                    pct = ((price - prev) / prev) * 100.0
                elif price is not None and item.last_price:
                    pct = ((price - float(item.last_price)) / float(item.last_price)) * 100.0

            if price is None:
                continue

            if pct is not None and abs(pct) >= float(item.threshold_pct) and item.last_price is not None:
                alert = Alert(
                    id=uuid.uuid4(),
                    agent_id=item.agent_id,
                    instrument_symbol=item.instrument_symbol.upper(),
                    pct_change=round(pct, 4),
                    severity=_severity(pct),
                    delivered=False,
                )
                session.add(alert)
                written += 1
                log.info(
                    "Alert %s %s %.2f%% (threshold %.2f)",
                    item.instrument_symbol,
                    item.agent_id,
                    pct,
                    float(item.threshold_pct),
                )

            item.last_price = price
            item.updated_at = datetime.now(timezone.utc)
        session.commit()
    finally:
        session.close()
    return written


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Infyro OpenClaw market worker")
    parser.add_argument("--once", action="store_true", help="Run a single scan and exit")
    parser.add_argument("--interval", type=int, default=300, help="Seconds between scans")
    args = parser.parse_args()
    if args.once:
        n = evaluate_once()
        log.info("Wrote %s alerts", n)
        return
    log.info("Starting loop every %ss", args.interval)
    while True:
        try:
            n = evaluate_once()
            log.info("Scan complete (%s alerts)", n)
        except Exception:  # noqa: BLE001
            log.exception("Scan failed")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
