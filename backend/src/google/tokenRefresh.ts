import { config } from "../config.js";
import { getGoogleTokens } from "../db/googleTokens.js";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

const cache = new Map<string, CachedToken>();

const PROACTIVE_REFRESH_MS = 60_000;

export function invalidateAccessTokenCache(userId: string): void {
  cache.delete(userId);
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt - Date.now() > PROACTIVE_REFRESH_MS) {
    return cached.accessToken;
  }

  const row = await getGoogleTokens(userId);
  if (!row?.refresh_token) {
    throw new Error("No Google refresh token stored for this user");
  }

  const body = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google access token: ${text}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cache.set(userId, {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });

  return json.access_token;
}
