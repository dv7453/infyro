import { SKIP_AUTH } from "@/lib/flags";

const API_BASE = import.meta.env.VITE_API_URL || "";

const TOKEN_KEY = "infyro_tokens_v1";

export function getTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null") || {};
  } catch {
    return {};
  }
}

export function setTokens({ access_token, refresh_token } = {}) {
  const prev = getTokens();
  const next = {
    access_token: access_token ?? prev.access_token ?? null,
    refresh_token: refresh_token ?? prev.refresh_token ?? null,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  return next;
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code || "unknown";
    this.status = status || 0;
  }
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

let refreshPromise = null;
let devLoginPromise = null;

async function refreshAccess() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refresh_token } = getTokens();
      if (!refresh_token) throw new ApiError("Sign in again.", "refresh_invalid", 401);
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
      });
      const data = await parseBody(res);
      if (!res.ok) {
        clearTokens();
        throw new ApiError(data?.error || "Sign in again.", data?.code || "refresh_invalid", res.status);
      }
      setTokens(data);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function ensureDevSession() {
  if (!SKIP_AUTH) throw new ApiError("Sign in again.", "missing_token", 401);
  if (!devLoginPromise) {
    devLoginPromise = (async () => {
      const res = await fetch(`${API_BASE}/auth/dev-login`, { method: "POST" });
      const data = await parseBody(res);
      if (!res.ok) {
        throw new ApiError(data?.error || "Dev login failed.", data?.code || "dev_login_failed", res.status);
      }
      setTokens(data);
      return data.access_token;
    })().finally(() => {
      devLoginPromise = null;
    });
  }
  return devLoginPromise;
}

export async function api(path, { method = "GET", body, auth = true, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    let { access_token } = getTokens();
    if (!access_token && SKIP_AUTH) {
      try {
        access_token = await ensureDevSession();
      } catch {
        /* continue; request may 401 */
      }
    }
    if (access_token) headers.Authorization = `Bearer ${access_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    try {
      if (SKIP_AUTH) {
        await ensureDevSession();
      } else {
        await refreshAccess();
      }
      return api(path, { method, body, auth, retry: false });
    } catch {
      /* fall through */
    }
  }

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(
      data?.error || "Something went wrong. Try again.",
      data?.code || "http_error",
      res.status,
    );
  }
  return data;
}

export const authApi = {
  phone: (phone_number) =>
    api("/auth/phone", { method: "POST", body: { phone_number }, auth: false }),
  verify: (phone_number, code) =>
    api("/auth/verify", { method: "POST", body: { phone_number, code }, auth: false }),
  resend: (phone_number) =>
    api("/auth/resend", { method: "POST", body: { phone_number }, auth: false }),
  completeProfile: (name, email, age) =>
    api("/auth/complete-profile", {
      method: "POST",
      body: { name, email, age: Number(age) },
    }),
  pairingStatus: (phone_number) =>
    api(`/auth/pairing-status?phone_number=${encodeURIComponent(phone_number)}`, {
      auth: false,
    }),
  /** MVP only — requires INFYRO_DEV_MODE=1 on the API */
  devLogin: () => api("/auth/dev-login", { method: "POST", auth: false }),
};

export const agentsApi = {
  list: () => api("/agents"),
  get: (id) => api(`/agents/${id}`),
  create: (body) => api("/agents", { method: "POST", body }),
  patch: (id, body) => api(`/agents/${id}`, { method: "PATCH", body }),
  remove: (id) => api(`/agents/${id}`, { method: "DELETE" }),
  setSources: (id, source_ids) =>
    api(`/agents/${id}/sources`, { method: "POST", body: { source_ids } }),
  memory: (id) => api(`/agents/${id}/memory`),
  clearMemory: async (id) => {
    const rows = await api(`/agents/${id}/memory`);
    await Promise.all(
      (rows || []).map((m) => api(`/agents/${id}/memory/${m.id}`, { method: "DELETE" })),
    );
  },
  conversation: (id) => api(`/agents/${id}/conversation`),
  telegramOpen: (id) => api(`/agents/${id}/telegram-open`, { method: "POST" }),
};

export const catalogApi = {
  list: () => api("/catalog"),
};

export const alertsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.agent) q.set("agent", params.agent);
    const qs = q.toString();
    return api(`/alerts${qs ? `?${qs}` : ""}`);
  },
};

export const settingsApi = {
  get: () => api("/settings"),
  patch: (body) => api("/settings", { method: "PATCH", body }),
  setLlmKey: (body) => api("/settings/llm-keys", { method: "POST", body }),
  linkTelegram: () => api("/settings/link-telegram", { method: "POST" }),
  unlinkTelegram: () => api("/settings/unlink-telegram", { method: "POST" }),
  deleteAccount: () => api("/settings/account", { method: "DELETE" }),
};
