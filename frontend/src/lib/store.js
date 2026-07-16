import { useRef, useSyncExternalStore } from "react";
import {
  agentsApi,
  alertsApi,
  authApi,
  catalogApi,
  clearTokens,
  getTokens,
  setTokens,
  settingsApi,
} from "@/lib/api";
import { SKIP_AUTH } from "@/lib/flags";
import { mapAgent, mapAlert, mapCatalog, mapUserProfile, splitPhone } from "@/lib/mappers";

const KEY = "infyro_state_v1";

const defaultState = {
  isAuthenticated: false,
  bootstrapped: false,
  phone: "",
  countryCode: "+91",
  fullPhone: "",
  pendingOtp: null,
  otpMeta: null,
  profile: {
    name: "",
    email: "",
    age: "",
    complete: false,
  },
  agents: [],
  alerts: [],
  catalog: [],
  theme: "light",
  telegramLinked: false,
  botUsername: "InfyroMarketBot",
  notifications: {
    push: true,
    telegram: true,
    digest: false,
    alertsEnabled: true,
  },
};

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || "light",
      countryCode: parsed.countryCode || "+91",
    };
  } catch {
    return {};
  }
};

let state = { ...defaultState, ...loadLocal() };
const listeners = new Set();

const persistUi = () => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        theme: state.theme,
        countryCode: state.countryCode,
      }),
    );
  } catch {
    /* ignore */
  }
};

const notify = () => {
  persistUi();
  listeners.forEach((l) => l());
};

export const store = {
  getState: () => state,
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set: (patch) => {
    state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    notify();
  },
  reset: () => {
    const theme = state.theme;
    const countryCode = state.countryCode;
    state = { ...defaultState, theme, countryCode, bootstrapped: true };
    notify();
  },
};

const sameSnapshot = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => Object.is(v, b[i]));
  }
  return false;
};

export const useStore = (selector = (s) => s) => {
  const cache = useRef({ selection: undefined, has: false });
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const next = selector(store.getState());
      if (cache.current.has && sameSnapshot(cache.current.selection, next)) {
        return cache.current.selection;
      }
      cache.current = { selection: next, has: true };
      return next;
    },
    () => selector(defaultState),
  );
};

function applySession(user, tokens) {
  if (tokens) setTokens(tokens);
  const { countryCode, phone } = splitPhone(user.phone_number);
  store.set({
    isAuthenticated: true,
    fullPhone: user.phone_number,
    countryCode,
    phone,
    profile: mapUserProfile(user),
    telegramLinked: !!user.telegram_linked,
  });
}

async function refreshAppData() {
  const [agents, alerts, catalog, settings] = await Promise.all([
    agentsApi.list(),
    alertsApi.list(),
    catalogApi.list(),
    settingsApi.get(),
  ]);
  const mappedAgents = (agents || []).map(mapAgent);
  store.set({
    agents: mappedAgents,
    alerts: (alerts || []).map((a) => mapAlert(a, mappedAgents)),
    catalog: (catalog || []).map(mapCatalog),
    telegramLinked: !!settings.telegram_linked,
    botUsername: settings.bot_username || "InfyroMarketBot",
    profile: {
      name: settings.name || "",
      email: settings.email || "",
      age: settings.age != null ? String(settings.age) : "",
      complete: !!settings.profile_complete,
    },
    notifications: {
      ...store.getState().notifications,
      alertsEnabled: settings.alerts_enabled !== false,
      telegram: !!settings.telegram_linked,
    },
  });
  return { agents: mappedAgents, settings };
}

export const actions = {
  setPhone: (countryCode, phone) => {
    const digits = String(phone).replace(/\D/g, "");
    store.set({
      countryCode,
      phone: digits,
      fullPhone: `${countryCode}${digits}`,
    });
  },

  setProfileField: (field, value) => {
    store.set((s) => ({
      ...s,
      profile: { ...s.profile, [field]: value },
    }));
  },

  setTheme: (theme) => store.set({ theme }),

  setNotification: (key, value) => {
    store.set((s) => ({
      ...s,
      notifications: { ...s.notifications, [key]: value },
    }));
  },

  async bootstrap() {
    try {
      if (SKIP_AUTH) {
        // Silent MVP session — auth UI stays in the repo, just not required.
        const res = await authApi.devLogin();
        applySession(res.user, {
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        await refreshAppData();
        return;
      }

      const { access_token, refresh_token } = getTokens();
      if (!access_token && !refresh_token) {
        store.set({ isAuthenticated: false });
        return;
      }
      const settings = await settingsApi.get();
      applySession(
        {
          phone_number: settings.phone_number,
          name: settings.name,
          email: settings.email,
          age: settings.age,
          profile_complete: settings.profile_complete,
                      telegram_linked: settings.telegram_linked,
                    },
                    null,
                  );
                  // keep bot username available for UI opens
                  store.set({
                    botUsername: settings.bot_username || "InfyroMarketBot",
                  });
                  if (settings.profile_complete) {
                    await refreshAppData();
                  }
    } catch (err) {
      if (SKIP_AUTH) {
        // Still open the shell, but keep trying for a real JWT so API calls work.
        try {
          const res = await authApi.devLogin();
          applySession(res.user, {
            access_token: res.access_token,
            refresh_token: res.refresh_token,
          });
          await refreshAppData();
          return;
        } catch {
          store.set({
            isAuthenticated: true,
            profile: {
              name: "MVP Tester",
              email: "mvp@infyro.local",
              age: "26",
              complete: true,
            },
            phone: "9999000000",
            countryCode: "+91",
            fullPhone: "+919999000000",
          });
        }
      } else {
        clearTokens();
        store.reset();
      }
    } finally {
      store.set({ bootstrapped: true });
    }
  },

  async requestOtp(countryCode, phoneDigits) {
    const digits = String(phoneDigits).replace(/\D/g, "");
    const fullPhone = `${countryCode}${digits}`;
    const res = await authApi.phone(fullPhone);
    store.set({
      countryCode,
      phone: digits,
      fullPhone: res.phone_number || fullPhone,
      pendingOtp: res.otp || null,
      otpMeta: {
        deliveredVia: res.delivered_via,
        botUsername: res.bot_username,
        deepLink: res.deep_link || null,
        needsTelegramStart: !!res.needs_telegram_start,
      },
    });
    return res;
  },

  async resendOtp() {
    const full = store.getState().fullPhone;
    if (!full) throw new Error("Missing phone number.");
    const res = await authApi.resend(full);
    store.set({
      pendingOtp: res.otp || null,
      otpMeta: {
        deliveredVia: res.delivered_via,
        botUsername: res.bot_username,
        deepLink: res.deep_link || null,
        needsTelegramStart: !!res.needs_telegram_start,
      },
    });
    return res;
  },

  async verifyOtp(code) {
    const full = store.getState().fullPhone;
    const res = await authApi.verify(full, code);
    applySession(res.user, {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    });
    store.set({ pendingOtp: null });
    if (res.next_step === "dashboard" || res.user.profile_complete) {
      await refreshAppData();
    }
    return res;
  },

  async completeProfile(overrides = {}) {
    const { profile } = store.getState();
    const name = overrides.name ?? profile.name;
    const email = overrides.email ?? profile.email;
    const age = overrides.age ?? profile.age;
    const res = await authApi.completeProfile(name, email, age);
    store.set({
      profile: mapUserProfile(res.user),
      telegramLinked: !!res.user.telegram_linked,
    });
    await refreshAppData();
    return res;
  },

  async refreshData() {
    return refreshAppData();
  },

  async addAgent(input) {
    const body = {
      name: input.name,
      avatar_color: input.color,
      persona: input.personaText || input.persona || "",
      llm_provider: input.llmProvider || "groq",
      llm_api_key: input.apiKey || null,
      source_ids: input.sourceIds || [],
      status: "listening",
    };
    const created = await agentsApi.create(body);
    const agent = mapAgent(created);
    store.set((s) => ({ ...s, agents: [agent, ...s.agents] }));
    return agent;
  },

  async updateAgent(id, patch) {
    const body = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.color !== undefined) body.avatar_color = patch.color;
    if (patch.personaText !== undefined) body.persona = patch.personaText;
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.sourceIds !== undefined) body.source_ids = patch.sourceIds;
    if (patch.llmProvider !== undefined) body.llm_provider = patch.llmProvider;

    const key = (patch.apiKey || "").trim();
    if (key) {
      body.llm_api_key = key;
      body.llm_provider = patch.llmProvider || "groq";
    }

    const updated = await agentsApi.patch(id, body);
    // Also hit dedicated key endpoint so encrypted storage is unambiguous.
    if (key) {
      await settingsApi.setLlmKey({
        agent_id: id,
        llm_provider: body.llm_provider || "groq",
        llm_api_key: key,
      });
    }
    const agent = mapAgent(
      key ? { ...updated, has_llm_key: true, llm_provider: body.llm_provider || "groq" } : updated,
    );
    store.set((s) => ({
      ...s,
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...agent } : a)),
    }));
    return agent;
  },

  async deleteAgent(id) {
    await agentsApi.remove(id);
    store.set((s) => ({
      ...s,
      agents: s.agents.filter((a) => a.id !== id),
      alerts: s.alerts.filter((al) => al.agentId !== id),
    }));
  },

  async toggleAgentStatus(id) {
    const agent = store.getState().agents.find((a) => a.id === id);
    if (!agent) return;
    const next = agent.status === "listening" ? "paused" : "listening";
    await actions.updateAgent(id, { status: next });
  },

  async forgetMemory(id) {
    await agentsApi.clearMemory(id);
    store.set((s) => ({
      ...s,
      agents: s.agents.map((a) => (a.id === id ? { ...a, memory: [] } : a)),
    }));
  },

  async loadAgentExtras(id) {
    const [memory, conversation] = await Promise.all([
      agentsApi.memory(id),
      agentsApi.conversation(id),
    ]);
    store.set((s) => ({
      ...s,
      agents: s.agents.map((a) =>
        a.id === id
          ? {
              ...a,
              memory: (memory || []).map((m) => m.summary_text || m.id),
              transcript: (conversation || [])
                .slice()
                .reverse()
                .map((c) => ({
                  role: c.direction === "inbound" ? "user" : "agent",
                  text: c.body,
                  at: c.created_at,
                })),
            }
          : a,
      ),
    }));
  },

  async addSourceToAgent(agentId, sourceId) {
    const agent = store.getState().agents.find((a) => a.id === agentId);
    if (!agent) return;
    const sourceIds = Array.from(new Set([...(agent.sourceIds || []), sourceId]));
    return actions.updateAgent(agentId, { sourceIds });
  },

  async setAlertsEnabled(v) {
    const settings = await settingsApi.patch({ alerts_enabled: v });
    store.set((s) => ({
      ...s,
      notifications: {
        ...s.notifications,
        alertsEnabled: settings.alerts_enabled,
        push: settings.alerts_enabled,
      },
    }));
  },

  async linkTelegram() {
    const res = await settingsApi.linkTelegram();
    store.set({ telegramLinked: !!res.telegram_linked });
    return res;
  },

  async unlinkTelegram() {
    await settingsApi.unlinkTelegram();
    store.set({ telegramLinked: false });
  },

  async openAgentTelegram(agentId) {
    const res = await agentsApi.telegramOpen(agentId);
    if (res.linked) {
      store.set({ telegramLinked: true });
    }
    return res;
  },

  async signOut() {
    clearTokens();
    store.reset();
  },

  async deleteAccount() {
    try {
      await settingsApi.deleteAccount();
    } catch {
      /* still clear locally */
    }
    clearTokens();
    store.reset();
  },
};
