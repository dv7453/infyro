"""Hermes-role Infyro runtime: Telegram surface, BYOK LLM chat, memory, alert delivery.

Owns Telegram. Never opens a raw product DB connection for business logic outside
shared helpers used by Auth MCP path — conversation tools go through finance-tools
patterns here via SQLAlchemy models shared with the MCP (same tables).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

# Ensure workspace packages importable when run as script
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))
sys.path.insert(0, str(ROOT / "packages" / "db"))

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from infyro_db.models import (
    ActiveAgent,
    Agent,
    AgentMcpBinding,
    Alert,
    ConversationLog,
    MemoryEntry,
    TelegramLink,
    WatchlistItem,
)
from infyro_db.session import SessionLocal
from infyro_db.settings import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [hermes] %(message)s")
log = logging.getLogger("hermes-runtime")

# Tool name → allowed source catalogs
SOURCE_TOOLS = {
    "CoinGecko": {"get_crypto_price", "get_trending_crypto"},
    "Yahoo Finance": {"get_stock_quote", "get_stock_history"},
    "Alpha Vantage": {"get_alpha_quote"},
    "News": {"search_market_news"},
}


def _telegram_api(method: str, payload: dict) -> dict:
    settings = get_settings()
    token = settings.telegram_bot_token
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN missing")
    url = f"https://api.telegram.org/bot{token}/{method}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def send_message(chat_id: int, text: str) -> None:
    _telegram_api("sendMessage", {"chat_id": chat_id, "text": text[:4000]})


def decrypt_key(encrypted: str) -> str:
    from cryptography.fernet import Fernet

    settings = get_settings()
    return Fernet(settings.fernet_key.encode()).decrypt(encrypted.encode()).decode()


def resolve_agent(session: Session, chat_id: int) -> Optional[Agent]:
    active = session.get(ActiveAgent, chat_id)
    if active:
        return session.scalar(
            select(Agent)
            .options(joinedload(Agent.bindings).joinedload(AgentMcpBinding.catalog))
            .where(Agent.id == active.agent_id)
        )
    link = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
    if not link:
        return None
    agent = session.scalar(
        select(Agent)
        .options(joinedload(Agent.bindings).joinedload(AgentMcpBinding.catalog))
        .where(Agent.user_id == link.user_id, Agent.status == "listening")
        .order_by(Agent.created_at.asc())
    )
    if agent:
        session.merge(ActiveAgent(chat_id=chat_id, agent_id=agent.id, user_id=link.user_id))
        session.commit()
    return agent


def allowed_tools_for_agent(agent: Agent) -> set[str]:
    names = {b.catalog.name for b in agent.bindings if b.catalog}
    tools: set[str] = set()
    for name in names:
        tools |= SOURCE_TOOLS.get(name, set())
    return tools


def tool_get_crypto_price(symbol: str) -> dict:
    mapping = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana"}
    coin_id = mapping.get(symbol.upper(), symbol.lower())
    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={coin_id}&vs_currencies=usd&include_24hr_change=true"
    )
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.loads(resp.read().decode())
    row = data.get(coin_id) or {}
    return {
        "symbol": symbol.upper(),
        "price_usd": row.get("usd"),
        "change_24h_pct": row.get("usd_24h_change"),
    }


def tool_get_trending_crypto() -> dict:
    url = "https://api.coingecko.com/api/v3/search/trending"
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.loads(resp.read().decode())
    coins = [
        {"id": c["item"]["id"], "name": c["item"]["name"], "symbol": c["item"]["symbol"]}
        for c in (data.get("coins") or [])[:7]
    ]
    return {"trending": coins}


def tool_get_stock_quote(symbol: str) -> dict:
    import yfinance as yf

    info = yf.Ticker(symbol.upper()).fast_info
    price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
    prev = getattr(info, "previous_close", None) or getattr(info, "previousClose", None)
    pct = None
    if price is not None and prev:
        pct = ((float(price) - float(prev)) / float(prev)) * 100
    return {
        "symbol": symbol.upper(),
        "price": float(price) if price is not None else None,
        "previous_close": float(prev) if prev is not None else None,
        "change_pct": pct,
    }


def tool_get_stock_history(symbol: str, period: str = "5d") -> dict:
    import yfinance as yf

    hist = yf.Ticker(symbol.upper()).history(period=period)
    bars = []
    for idx, row in hist.tail(10).iterrows():
        bars.append({"date": str(idx.date()), "close": float(row["Close"])})
    return {"symbol": symbol.upper(), "bars": bars}


def tool_get_alpha_quote(symbol: str) -> dict:
    settings = get_settings()
    key = settings.alpha_vantage_api_key
    if not key:
        return {"error": "Alpha Vantage key not configured on server"}
    url = (
        f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE"
        f"&symbol={symbol.upper()}&apikey={key}"
    )
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.loads(resp.read().decode())
    return data.get("Global Quote") or data


def tool_search_market_news(query: str) -> dict:
    # Keyless RSS-ish placeholder using DuckDuckGo HTML lite — keep honest about limits
    return {
        "query": query,
        "note": "News source is a stretch feature; no headlines fetched in this build.",
        "results": [],
    }


TOOL_IMPL = {
    "get_crypto_price": lambda args: tool_get_crypto_price(args.get("symbol", "BTC")),
    "get_trending_crypto": lambda args: tool_get_trending_crypto(),
    "get_stock_quote": lambda args: tool_get_stock_quote(args.get("symbol", "AAPL")),
    "get_stock_history": lambda args: tool_get_stock_history(
        args.get("symbol", "AAPL"), args.get("period", "5d")
    ),
    "get_alpha_quote": lambda args: tool_get_alpha_quote(args.get("symbol", "AAPL")),
    "search_market_news": lambda args: tool_search_market_news(args.get("query", "")),
}

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_crypto_price",
            "description": "Get USD price for a crypto asset via CoinGecko",
            "parameters": {
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trending_crypto",
            "description": "Trending coins on CoinGecko",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_quote",
            "description": "Stock quote via Yahoo Finance",
            "parameters": {
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_history",
            "description": "Recent stock history via Yahoo Finance",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "period": {"type": "string"},
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alpha_quote",
            "description": "Quote via Alpha Vantage free tier",
            "parameters": {
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_market_news",
            "description": "Search market headlines (stretch)",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
]


def filter_tools(allowed: set[str]) -> list[dict]:
    return [t for t in OPENAI_TOOLS if t["function"]["name"] in allowed]


# Cloudflare (Groq edge) blocks Python-urllib's default UA with 403/1010.
_LLM_HEADERS = {
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
}


def call_llm(
    provider: str,
    api_key: str,
    system: str,
    messages: list[dict],
    tools: list[dict],
) -> dict:
    api_key = (api_key or "").strip()
    if not api_key:
        raise ValueError("Missing API key")

    if provider == "groq":
        base = "https://api.groq.com/openai/v1"
        model = get_settings().groq_chat_model or "llama-3.3-70b-versatile"
    elif provider == "openai":
        base = "https://api.openai.com/v1"
        model = get_settings().openai_chat_model or "gpt-4o-mini"
    elif provider == "claude":
        return call_anthropic(api_key, system, messages, tools)
    else:
        raise ValueError(f"Unknown provider {provider}")

    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *messages],
        "temperature": 0.2,
    }
    # Only attach tools when non-empty — empty tools + tool_choice can 400 on Groq.
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"

    try:
        with httpx.Client(timeout=90.0, headers=_LLM_HEADERS) as client:
            resp = client.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=body,
            )
        if resp.status_code == 400 and tools:
            log.warning("LLM 400 with tools; retrying without tools: %s", resp.text[:500])
            return call_llm(provider, api_key, system, messages, tools=[])
        if resp.status_code >= 400:
            raise RuntimeError(f"{provider} HTTP {resp.status_code}: {resp.text[:500]}")
        return resp.json()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"{provider} request failed: {exc}") from exc


def call_anthropic(api_key: str, system: str, messages: list[dict], tools: list[dict]) -> dict:
    # Map to Anthropic format, return OpenAI-like structure for unified loop
    anth_tools = []
    for t in tools:
        fn = t["function"]
        anth_tools.append(
            {
                "name": fn["name"],
                "description": fn.get("description", ""),
                "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
            }
        )
    anth_msgs = []
    for m in messages:
        if m["role"] == "tool":
            anth_msgs.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m.get("tool_call_id", "tool"),
                            "content": m.get("content", ""),
                        }
                    ],
                }
            )
        else:
            anth_msgs.append({"role": m["role"], "content": m.get("content") or ""})

    body = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system": system,
        "messages": anth_msgs or [{"role": "user", "content": "Hello"}],
    }
    if anth_tools:
        body["tools"] = anth_tools
    with httpx.Client(timeout=90.0, headers=_LLM_HEADERS) as client:
        resp = client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
    text_parts = []
    tool_calls = []
    for block in data.get("content") or []:
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            tool_calls.append(
                {
                    "id": block["id"],
                    "type": "function",
                    "function": {
                        "name": block["name"],
                        "arguments": json.dumps(block.get("input") or {}),
                    },
                }
            )
    message = {"role": "assistant", "content": "\n".join(text_parts) or None}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {"choices": [{"message": message}]}


def resolve_api_key(agent: Agent) -> str:
    """Prefer encrypted BYOK on the agent; fall back to server .env for MVP."""
    settings = get_settings()
    if agent.llm_api_key_encrypted:
        try:
            return decrypt_key(agent.llm_api_key_encrypted).strip()
        except Exception:  # noqa: BLE001
            log.exception("Failed to decrypt agent LLM key")
    provider = (agent.llm_provider or "groq").lower()
    if provider == "groq" and settings.groq_api_key:
        return settings.groq_api_key.strip()
    if provider == "openai" and settings.openai_api_key:
        return settings.openai_api_key.strip()
    if provider == "claude" and settings.anthropic_api_key:
        return settings.anthropic_api_key.strip()
    return ""


def _fmt_pct(pct: Any) -> str:
    try:
        v = float(pct)
    except (TypeError, ValueError):
        return ""
    sign = "+" if v >= 0 else ""
    return f" ({sign}{v:.2f}%)"


def format_quote_lines(tool_results: list[dict]) -> list[str]:
    """Render tool payloads as numbers-first lines (fallback if the model returns empty text)."""
    lines: list[str] = []
    seen: set[str] = set()
    for r in tool_results:
        if not isinstance(r, dict) or r.get("error"):
            continue
        if r.get("price_usd") is not None:
            sym = str(r.get("symbol") or "?").upper()
            if sym in seen:
                continue
            seen.add(sym)
            lines.append(f"{sym}  ${float(r['price_usd']):,.2f}{_fmt_pct(r.get('change_24h_pct'))}")
        elif r.get("price") is not None:
            sym = str(r.get("symbol") or "?").upper()
            if sym in seen:
                continue
            seen.add(sym)
            lines.append(f"{sym}  ${float(r['price']):,.2f}{_fmt_pct(r.get('change_pct'))}")
        elif isinstance(r.get("trending"), list) and r["trending"]:
            names = ", ".join(
                f"{c.get('symbol') or c.get('name')}" for c in r["trending"][:5]
            )
            lines.append(f"Trending: {names}")
    return lines


def compose_reply(llm_text: str, tool_results: list[dict]) -> str:
    """Trust the model for chat; only format tool JSON if it returned no text."""
    text = (llm_text or "").strip()
    if text:
        return text
    quote_lines = format_quote_lines(tool_results)
    if quote_lines:
        return "\n".join(quote_lines)
    return "I couldn't answer that. Try again with a ticker or a clearer ask."


def agent_watchlist_symbols(session: Session, agent_id: Any, limit: int = 12) -> list[str]:
    rows = session.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.agent_id == agent_id)
        .order_by(WatchlistItem.instrument_symbol.asc())
        .limit(limit)
    ).all()
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        sym = (row.instrument_symbol or "").strip().upper()
        if sym and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


def recent_chat_messages(session: Session, agent_id: Any, user_text: str, limit: int = 10) -> list[dict]:
    """Prior Telegram turns — required so the model has conversational context."""
    rows = list(
        session.scalars(
            select(ConversationLog)
            .where(ConversationLog.agent_id == agent_id)
            .order_by(ConversationLog.created_at.desc())
            .limit(limit + 1)
        ).all()
    )
    rows.reverse()
    if rows and rows[-1].direction == "in" and (rows[-1].body or "").strip() == user_text.strip():
        rows = rows[:-1]
    msgs: list[dict] = []
    for r in rows[-limit:]:
        body = (r.body or "").strip()
        if not body:
            continue
        role = "user" if r.direction == "in" else "assistant"
        msgs.append({"role": role, "content": body[:1500]})
    msgs.append({"role": "user", "content": user_text})
    return msgs


def build_system_prompt(agent: Agent, memory_block: str, allowed: set[str], watchlist: list[str]) -> str:
    if watchlist:
        watch_line = (
            f"This agent's watchlist (use these when the user asks vaguely about "
            f"prices/the market): {', '.join(watchlist)}."
        )
    else:
        watch_line = (
            "This agent has an empty watchlist. If the user asks for prices with no "
            "symbols, ask which tickers — or reuse symbols from the recent chat. "
            "Do not invent a default mega-cap list."
        )
    return (
        f"You are {agent.name}, an Infyro markets co-pilot on Telegram.\n"
        f"Persona:\n{agent.persona or '(none)'}\n\n"
        f"What you have learned about this user:\n{memory_block}\n\n"
        f"{watch_line}\n\n"
        "Behavior:\n"
        "- Decide from the LATEST user message only whether tools are needed.\n"
        "- Prior market replies in history are context — do not re-fetch quotes "
        "just because they appear earlier in the thread.\n"
        "- Social / conversational messages (thanks, ok, cool, greetings, small talk): "
        "reply naturally in one short line. Never call tools.\n"
        "- Market questions: call tools before stating any price. Never invent numbers.\n"
        "- After tools return, reply with the numbers clearly (SYMBOL $price ±%).\n"
        "- Prefer the watchlist (or symbols the user named) over guessing.\n"
        f"- Allowed tools: {sorted(allowed) or ['none']}"
    )


def run_agent_turn(session: Session, agent: Agent, user_text: str) -> str:
    if agent.status != "listening":
        return f"{agent.name} is paused. Resume it from the dashboard to chat."

    api_key = resolve_api_key(agent)
    if not api_key:
        return (
            f"{agent.name} needs an LLM API key. Add a Groq key under How it talks "
            "in the dashboard, or set GROQ_API_KEY in .env for MVP."
        )

    allowed = allowed_tools_for_agent(agent)
    tools = filter_tools(allowed)
    watchlist = agent_watchlist_symbols(session, agent.id)

    memory_rows = session.scalars(
        select(MemoryEntry)
        .where(MemoryEntry.agent_id == agent.id)
        .order_by(MemoryEntry.created_at.desc())
        .limit(8)
    ).all()
    memory_block = "\n".join(f"- {m.summary_text}" for m in memory_rows) or "- (none yet)"
    system = build_system_prompt(agent, memory_block, allowed, watchlist)
    messages: list[dict] = recent_chat_messages(session, agent.id, user_text)
    tool_results: list[dict] = []

    for _ in range(4):
        raw = call_llm(agent.llm_provider or "groq", api_key, system, messages, tools)
        msg = raw["choices"][0]["message"]
        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return compose_reply(msg.get("content") or "", tool_results)

        messages.append(
            {
                "role": "assistant",
                "content": msg.get("content"),
                "tool_calls": tool_calls,
            }
        )
        for tc in tool_calls:
            name = tc["function"]["name"]
            if name not in allowed:
                result: dict = {"error": f"Tool {name} is not bound to this agent"}
            else:
                try:
                    args = json.loads(tc["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                try:
                    result = TOOL_IMPL[name](args)
                except Exception as exc:  # noqa: BLE001
                    result = {"error": str(exc)}
            if isinstance(result, dict):
                tool_results.append(result)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                }
            )

    messages.append(
        {
            "role": "user",
            "content": (
                "Using only the tool results above, answer the user's latest message now. "
                "Lead with numbers when you have them. Do not ask unnecessary follow-ups."
            ),
        }
    )
    raw = call_llm(agent.llm_provider or "groq", api_key, system, messages, tools=[])
    final = (raw["choices"][0]["message"].get("content") or "").strip()
    return compose_reply(final, tool_results)


async def handle_start(session: Session, chat_id: int, token: Optional[str]) -> None:
    # Delegate to API auth service helpers
    from infyro_api.services import auth_service

    reply = await auth_service.handle_telegram_start(session, chat_id, token)
    send_message(chat_id, reply)


def handle_chat(session: Session, chat_id: int, text: str) -> None:
    if text.startswith("/agents"):
        link = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
        if not link:
            send_message(chat_id, "Link your phone in the Infyro dashboard first.")
            return
        agents = session.scalars(select(Agent).where(Agent.user_id == link.user_id)).all()
        if not agents:
            send_message(chat_id, "No agents yet. Create one in the dashboard.")
            return
        lines = ["Your agents:"]
        for i, a in enumerate(agents, 1):
            lines.append(f"{i}. {a.name} ({a.status}) — /use_{a.id.hex[:8]}")
        send_message(chat_id, "\n".join(lines))
        return

    if text.startswith("/use_"):
        prefix = text[5:].strip()
        link = session.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
        if not link:
            send_message(chat_id, "Link your phone in the Infyro dashboard first.")
            return
        agents = session.scalars(select(Agent).where(Agent.user_id == link.user_id)).all()
        match = next((a for a in agents if a.id.hex.startswith(prefix)), None)
        if not match:
            send_message(chat_id, "Could not find that agent.")
            return
        session.merge(
            ActiveAgent(chat_id=chat_id, agent_id=match.id, user_id=link.user_id)
        )
        session.commit()
        send_message(chat_id, f"Now talking to {match.name}.")
        return

    agent = resolve_agent(session, chat_id)
    if not agent:
        send_message(
            chat_id,
            "No agent linked to this chat yet. Finish sign-in on the dashboard, then create an agent.",
        )
        return

    session.add(
        ConversationLog(agent_id=agent.id, direction="in", body=text)
    )
    session.commit()

    try:
        reply = run_agent_turn(session, agent, text)
    except Exception as exc:  # noqa: BLE001
        log.exception("LLM turn failed")
        detail = str(exc)
        if len(detail) > 280:
            detail = detail[:280] + "…"
        reply = f"Could not reach your LLM provider. {detail}"

    session.add(ConversationLog(agent_id=agent.id, direction="out", body=reply))
    session.commit()
    send_message(chat_id, reply)


def deliver_alerts(session: Session) -> int:
    rows = session.scalars(
        select(Alert).where(Alert.delivered.is_(False)).order_by(Alert.created_at.asc()).limit(20)
    ).all()
    n = 0
    for alert in rows:
        agent = session.get(Agent, alert.agent_id)
        if not agent:
            continue
        link = session.scalar(select(TelegramLink).where(TelegramLink.user_id == agent.user_id))
        if not link or not link.chat_id:
            continue
        sign = "+" if float(alert.pct_change) >= 0 else ""
        msg = (
            f"{agent.name}: {alert.instrument_symbol} moved {sign}{float(alert.pct_change):.2f}% "
            f"({alert.severity})."
        )
        try:
            send_message(link.chat_id, msg)
            alert.delivered = True
            session.add(
                ConversationLog(agent_id=agent.id, direction="out", body=msg)
            )
            n += 1
        except Exception:  # noqa: BLE001
            log.exception("Alert delivery failed %s", alert.id)
    session.commit()
    return n


async def process_update(update: dict) -> None:
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id or not text:
        return
    session = SessionLocal()
    try:
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            token = parts[1].strip() if len(parts) > 1 else None
            await handle_start(session, int(chat_id), token)
        else:
            handle_chat(session, int(chat_id), text)
    finally:
        session.close()


async def poll_loop() -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        log.error("Set TELEGRAM_BOT_TOKEN in .env before starting Hermes runtime")
        return
    offset = 0
    log.info("Hermes Telegram long-poll starting (bot @%s)", settings.telegram_bot_username)
    while True:
        try:
            data = _telegram_api(
                "getUpdates",
                {"timeout": 25, "offset": offset, "allowed_updates": ["message"]},
            )
            for upd in data.get("result") or []:
                offset = max(offset, int(upd["update_id"]) + 1)
                await process_update(upd)
            session = SessionLocal()
            try:
                delivered = deliver_alerts(session)
                if delivered:
                    log.info("Delivered %s alerts", delivered)
            finally:
                session.close()
        except urllib.error.HTTPError as exc:
            log.error("Telegram HTTP %s", exc.code)
            await asyncio.sleep(3)
        except Exception:  # noqa: BLE001
            log.exception("Poll loop error")
            await asyncio.sleep(3)


def main() -> None:
    asyncio.run(poll_loop())


if __name__ == "__main__":
    main()
