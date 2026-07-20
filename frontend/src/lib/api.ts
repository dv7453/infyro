import { getBackendUrl } from "@/lib/constants";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as {
        message?: string;
        detail?: string;
      };
      message = body.message ?? body.detail ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type ConnectionSettings = {
  email: string;
  scopes: string[];
};

export type PersonaSettings = {
  persona_prompt: string;
};

export type ToolPermissionsSettings = Record<string, "auto" | "confirm">;

export type DefaultsSettings = {
  timezone: string;
  working_hours: { start: string; end: string };
  default_drive_folder: string;
};

export function getConnection(accessToken: string) {
  return apiFetch<ConnectionSettings>("/api/settings/connection", accessToken);
}

export function getPersona(accessToken: string) {
  return apiFetch<PersonaSettings>("/api/settings/persona", accessToken);
}

export function updatePersona(accessToken: string, data: PersonaSettings) {
  return apiFetch<PersonaSettings>("/api/settings/persona", accessToken, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getToolPermissions(accessToken: string) {
  return apiFetch<ToolPermissionsSettings>(
    "/api/settings/tool-permissions",
    accessToken,
  );
}

export function updateToolPermissions(
  accessToken: string,
  data: ToolPermissionsSettings,
) {
  return apiFetch<ToolPermissionsSettings>(
    "/api/settings/tool-permissions",
    accessToken,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function getDefaults(accessToken: string) {
  return apiFetch<DefaultsSettings>("/api/settings/defaults", accessToken);
}

export function updateDefaults(accessToken: string, data: DefaultsSettings) {
  return apiFetch<DefaultsSettings>("/api/settings/defaults", accessToken, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function disconnect(accessToken: string) {
  return apiFetch<void>("/api/auth/disconnect", accessToken, {
    method: "POST",
  });
}

export type FeedbackSubmission = {
  id: string;
  email: string;
  name: string;
  message: string;
  created_at: string;
};

export function submitFeedback(
  accessToken: string,
  data: { name: string; message: string },
) {
  return apiFetch<FeedbackSubmission>("/api/feedback", accessToken, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export type TelegramStatus = {
  linked: boolean;
  chat_id: string | null;
  telegram_username: string | null;
  bot_username: string | null;
  configured: boolean;
};

export type TelegramLinkCode = {
  code: string;
  expires_at: string;
  bot_username: string | null;
  deep_link: string | null;
};

export function getTelegramStatus(accessToken: string) {
  return apiFetch<TelegramStatus>("/api/settings/telegram/status", accessToken);
}

export function generateTelegramCode(accessToken: string) {
  return apiFetch<TelegramLinkCode>(
    "/api/settings/telegram/generate-code",
    accessToken,
    { method: "POST" },
  );
}

export function unlinkTelegram(accessToken: string) {
  return apiFetch<{ ok: boolean }>(
    "/api/settings/telegram/unlink",
    accessToken,
    { method: "POST" },
  );
}

export type ByokProvider = "groq" | "openai";

export type ByokSettings = {
  provider: ByokProvider;
  has_key: boolean;
  key_hint: string | null;
};

export function getByok(accessToken: string) {
  return apiFetch<ByokSettings>("/api/settings/byok", accessToken);
}

export function updateByok(
  accessToken: string,
  data: {
    provider: ByokProvider;
    api_key?: string;
    clear?: boolean;
  },
) {
  return apiFetch<ByokSettings>("/api/settings/byok", accessToken, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function storeTokens(
  accessToken: string,
  providerRefreshToken: string,
  scopes: string,
) {
  const response = await fetch(`${getBackendUrl()}/api/auth/store-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider_refresh_token: providerRefreshToken,
      scopes,
    }),
  });

  if (!response.ok) {
    let message = `Failed to store tokens (${response.status})`;
    try {
      const body = (await response.json()) as {
        message?: string;
        detail?: string;
      };
      message = body.message ?? body.detail ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }
}
