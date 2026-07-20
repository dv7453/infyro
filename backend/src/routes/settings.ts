import { Router } from "express";
import { z } from "zod";
import { getGoogleTokens } from "../db/googleTokens.js";
import {
  DEFAULT_TOOL_PERMISSIONS,
  ensureAgentSettings,
  mergeDefaults,
  updateDefaults,
  updatePersonaPrompt,
  updateToolPermissions,
  type ToolPermission,
} from "../db/agentSettings.js";
import {
  deleteUserLlmKey,
  getUserLlmKey,
  isLlmProvider,
  maskApiKey,
  updateUserLlmProvider,
  upsertUserLlmKey,
} from "../db/llmKeys.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const settingsRouter = Router();

settingsRouter.get("/connection", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const tokens = await getGoogleTokens(user.id);
    res.json({
      email: user.email ?? "",
      scopes: tokens?.scopes ?? [],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load connection";
    res.status(500).json({ message });
  }
});

settingsRouter.get("/persona", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const settings = await ensureAgentSettings(user.id);
    res.json({ persona_prompt: settings.persona_prompt ?? "" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load persona";
    res.status(500).json({ message });
  }
});

const personaSchema = z.object({
  persona_prompt: z.string(),
});

settingsRouter.put("/persona", requireAuth, async (req, res) => {
  try {
    const parsed = personaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }
    const user = (req as AuthedRequest).user;
    const persona_prompt = await updatePersonaPrompt(
      user.id,
      parsed.data.persona_prompt,
    );
    res.json({ persona_prompt });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update persona";
    res.status(500).json({ message });
  }
});

settingsRouter.get("/tool-permissions", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const settings = await ensureAgentSettings(user.id);
    res.json({
      ...DEFAULT_TOOL_PERMISSIONS,
      ...(settings.tool_permissions ?? {}),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load tool permissions";
    res.status(500).json({ message });
  }
});

const toolPermissionsSchema = z.record(
  z.string(),
  z.enum(["auto", "confirm"] as const),
);

settingsRouter.put("/tool-permissions", requireAuth, async (req, res) => {
  try {
    const parsed = toolPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }
    const user = (req as AuthedRequest).user;
    const permissions = await updateToolPermissions(
      user.id,
      parsed.data as Record<string, ToolPermission>,
    );
    res.json(permissions);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update tool permissions";
    res.status(500).json({ message });
  }
});

settingsRouter.get("/defaults", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const settings = await ensureAgentSettings(user.id);
    res.json(mergeDefaults(settings.defaults));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load defaults";
    res.status(500).json({ message });
  }
});

const defaultsSchema = z.object({
  timezone: z.string(),
  working_hours: z.object({
    start: z.string(),
    end: z.string(),
  }),
  default_drive_folder: z.string(),
});

settingsRouter.put("/defaults", requireAuth, async (req, res) => {
  try {
    const parsed = defaultsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }
    const user = (req as AuthedRequest).user;
    const defaults = await updateDefaults(user.id, parsed.data);
    res.json(defaults);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update defaults";
    res.status(500).json({ message });
  }
});

settingsRouter.get("/byok", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const row = await getUserLlmKey(user.id);
    res.json({
      provider: row?.provider ?? "groq",
      has_key: Boolean(row?.api_key),
      key_hint: row?.api_key ? maskApiKey(row.api_key) : null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load BYOK settings";
    res.status(500).json({ message });
  }
});

const byokSchema = z.object({
  provider: z.enum(["groq", "openai"]),
  /** Omit or empty to keep the existing key when switching provider. */
  api_key: z.string().optional(),
  clear: z.boolean().optional(),
});

settingsRouter.put("/byok", requireAuth, async (req, res) => {
  try {
    const parsed = byokSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }
    const user = (req as AuthedRequest).user;
    const { provider, api_key, clear } = parsed.data;

    if (clear) {
      await deleteUserLlmKey(user.id);
      res.json({
        provider,
        has_key: false,
        key_hint: null,
      });
      return;
    }

    const trimmed = api_key?.trim() ?? "";
    if (trimmed) {
      if (!isLlmProvider(provider)) {
        res.status(400).json({ message: "Invalid provider" });
        return;
      }
      const row = await upsertUserLlmKey(user.id, provider, trimmed);
      res.json({
        provider: row.provider,
        has_key: true,
        key_hint: maskApiKey(row.api_key),
      });
      return;
    }

    const row = await updateUserLlmProvider(user.id, provider);
    res.json({
      provider: row.provider,
      has_key: true,
      key_hint: maskApiKey(row.api_key),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save BYOK settings";
    res.status(500).json({ message });
  }
});
