import { Router } from "express";
import {
  deleteLinkByUserId,
  generateLinkCode,
  getLinkByUserId,
} from "../db/telegram.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { config } from "../config.js";
import { clearTelegramSession } from "../telegram/sessions.js";

export const telegramSettingsRouter = Router();

function botUsername(): string | null {
  const raw = config.TELEGRAM_BOT_USERNAME.trim();
  if (!raw) return null;
  return raw.replace(/^@/, "");
}

function deepLink(code: string): string | null {
  const username = botUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${code}`;
}

telegramSettingsRouter.post("/generate-code", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const result = await generateLinkCode(user.id);
    res.json({
      code: result.code,
      expires_at: result.expires_at,
      bot_username: botUsername(),
      deep_link: deepLink(result.code),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate code";
    res.status(500).json({ message });
  }
});

telegramSettingsRouter.get("/status", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const link = await getLinkByUserId(user.id);
    res.json({
      linked: Boolean(link),
      chat_id: link?.chat_id ?? null,
      telegram_username: link?.telegram_username ?? null,
      bot_username: botUsername(),
      configured: Boolean(config.TELEGRAM_BOT_TOKEN),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load Telegram status";
    res.status(500).json({ message });
  }
});

telegramSettingsRouter.post("/unlink", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const link = await getLinkByUserId(user.id);
    if (link) {
      clearTelegramSession(link.chat_id);
    }
    await deleteLinkByUserId(user.id);
    res.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to unlink Telegram";
    res.status(500).json({ message });
  }
});
