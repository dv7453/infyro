import { Router } from "express";
import { config } from "../config.js";
import { processTelegramIncoming } from "../telegram/handler.js";

export const telegramWebhookRouter = Router();

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { username?: string };
  };
};

telegramWebhookRouter.post("/", (req, res) => {
  if (config.TELEGRAM_WEBHOOK_SECRET) {
    const header = req.header("x-telegram-bot-api-secret-token");
    if (header !== config.TELEGRAM_WEBHOOK_SECRET) {
      res.status(403).json({ message: "Invalid secret token" });
      return;
    }
  }

  // Acknowledge immediately — process asynchronously.
  res.status(200).json({ ok: true });

  const update = req.body as TelegramUpdate;
  const message = update.message;
  const chatId = message?.chat?.id;
  if (chatId == null) return;

  void processTelegramIncoming({
    chatId: String(chatId),
    text: message?.text ?? null,
    username: message?.from?.username ?? null,
  }).catch((err) => {
    console.error("Telegram webhook processing failed:", err);
  });
});
