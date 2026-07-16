export function mapAgent(a) {
  const sources = a.sources || [];
  return {
    id: a.id,
    name: a.name,
    color: a.avatar_color || "#4F46E5",
    watching: sources.map((s) => s.name).filter(Boolean),
    sourceIds: sources.map((s) => s.id),
    sources,
    market:
      sources.some((s) => s.category === "crypto") &&
      sources.some((s) => s.category === "stocks")
        ? "both"
        : sources.some((s) => s.category === "stocks")
          ? "stocks"
          : "crypto",
    persona: a.persona || "",
    personaText: a.persona || "",
    apiKey: "",
    hasApiKey: !!a.has_llm_key,
    llmProvider: a.llm_provider || "groq",
    status: a.status === "paused" ? "paused" : "listening",
    createdAt: a.created_at,
    memory: [],
    transcript: [],
  };
}

export function mapAlert(a, agents = []) {
  const pct = Number(a.pct_change ?? 0);
  const direction = a.direction || (pct >= 0 ? "up" : "down");
  const agent = agents.find((x) => x.id === a.agent_id);
  const color = a.agent_color || agent?.color || "#4F46E5";
  const symbol = a.instrument_symbol || "Market";
  const signed = `${pct >= 0 ? "+" : ""}${pct}%`;
  return {
    id: a.id,
    agentId: a.agent_id,
    agentName: a.agent_name || agent?.name || "Watcher",
    agentColor: color,
    symbol,
    direction,
    change: Math.abs(pct),
    text: `${symbol} is ${direction === "up" ? "up" : "down"} ${Math.abs(pct)}% (${signed}).`,
    at: a.created_at,
    delivered: a.delivered,
  };
}

export function mapCatalog(row) {
  return {
    id: row.id,
    name: row.name,
    market: row.category || "other",
    blurb: row.description || "",
    provider: row.provider,
    requiresKey: row.requires_key,
    toolNames: row.tool_names || [],
    badge: row.badge,
  };
}

export function mapUserProfile(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    age: user.age != null ? String(user.age) : "",
    complete: !!user.profile_complete,
  };
}

export function splitPhone(phoneNumber) {
  const raw = String(phoneNumber || "");
  const match = raw.match(/^(\+\d{1,3})(\d+)$/);
  if (match) return { countryCode: match[1], phone: match[2] };
  return { countryCode: "+91", phone: raw.replace(/\D/g, "") };
}
