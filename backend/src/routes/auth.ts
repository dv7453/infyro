import { Router } from "express";
import { z } from "zod";
import {
  deleteGoogleTokens,
  getGoogleTokens,
  upsertGoogleTokens,
} from "../db/googleTokens.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { invalidateAccessTokenCache } from "../google/tokenRefresh.js";

export const authRouter = Router();

function normalizeScopes(scopes: string | string[]): string[] {
  if (Array.isArray(scopes)) {
    return scopes.map((s) => s.trim()).filter(Boolean);
  }
  return scopes.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

const storeTokensSchema = z.object({
  provider_refresh_token: z.string().min(1),
  scopes: z.union([z.string(), z.array(z.string())]),
});

authRouter.post("/store-tokens", requireAuth, async (req, res) => {
  try {
    const parsed = storeTokensSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", detail: parsed.error.flatten() });
      return;
    }

    const user = (req as AuthedRequest).user;
    const scopes = normalizeScopes(parsed.data.scopes);

    await upsertGoogleTokens(
      user.id,
      parsed.data.provider_refresh_token,
      scopes,
    );
    invalidateAccessTokenCache(user.id);

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to store tokens";
    res.status(500).json({ message });
  }
});

authRouter.post("/disconnect", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const row = await getGoogleTokens(user.id);

    if (row?.refresh_token) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: row.refresh_token }),
        });
      } catch (revokeErr) {
        console.warn("Google token revoke failed:", revokeErr);
      }
    }

    await deleteGoogleTokens(user.id);
    invalidateAccessTokenCache(user.id);

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disconnect";
    res.status(500).json({ message });
  }
});
