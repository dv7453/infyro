"""Keyless Yahoo Finance MCP via yfinance."""

from __future__ import annotations

import json
from typing import Any

import yfinance as yf
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("yahoo-finance")


def _json(obj: Any) -> str:
    return json.dumps(obj, default=str)


@mcp.tool()
def get_quote(symbol: str) -> str:
    """Get a live-ish quote for a ticker symbol (e.g. AAPL, MSFT)."""
    t = yf.Ticker(symbol.upper())
    info = t.fast_info
    price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
    prev = getattr(info, "previous_close", None) or getattr(info, "previousClose", None)
    change_pct = None
    if price is not None and prev:
        change_pct = ((float(price) - float(prev)) / float(prev)) * 100.0
    return _json(
        {
            "symbol": symbol.upper(),
            "price": float(price) if price is not None else None,
            "previous_close": float(prev) if prev is not None else None,
            "change_pct": change_pct,
            "currency": getattr(info, "currency", None),
        }
    )


@mcp.tool()
def get_history(symbol: str, period: str = "5d", interval: str = "1d") -> str:
    """Get recent OHLCV history for a ticker."""
    t = yf.Ticker(symbol.upper())
    hist = t.history(period=period, interval=interval)
    if hist.empty:
        return _json({"symbol": symbol.upper(), "bars": []})
    bars = []
    for idx, row in hist.tail(30).iterrows():
        bars.append(
            {
                "date": str(idx.date()) if hasattr(idx, "date") else str(idx),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]),
            }
        )
    return _json({"symbol": symbol.upper(), "bars": bars})


@mcp.tool()
def search_ticker(query: str) -> str:
    """Search Yahoo Finance for tickers matching a query."""
    try:
        from yfinance import Search

        results = Search(query, max_results=8).quotes
        out = [
            {
                "symbol": q.get("symbol"),
                "shortname": q.get("shortname") or q.get("longname"),
                "exchange": q.get("exchange"),
                "quoteType": q.get("quoteType"),
            }
            for q in (results or [])
        ]
        return _json({"query": query, "results": out})
    except Exception as exc:  # noqa: BLE001
        return _json({"query": query, "results": [], "note": str(exc)})


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
