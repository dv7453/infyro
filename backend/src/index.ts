import http from "node:http";
import cors from "cors";
import express from "express";
import { config, getAllowedOrigins, isOriginAllowed } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { feedbackRouter } from "./routes/feedback.js";
import { settingsRouter } from "./routes/settings.js";
import { telegramSettingsRouter } from "./routes/telegramSettings.js";
import { telegramWebhookRouter } from "./routes/telegramWebhook.js";
import { whatsappSettingsRouter } from "./routes/whatsappSettings.js";
import { whatsappWebhookRouter } from "./routes/whatsappWebhook.js";
import { startTelegramPolling } from "./telegram/polling.js";
import { createWebSocketServer } from "./ws/handler.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/settings/whatsapp", whatsappSettingsRouter);
app.use("/api/settings/telegram", telegramSettingsRouter);
app.use("/webhooks/whatsapp", whatsappWebhookRouter);
app.use("/webhooks/telegram", telegramWebhookRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      message: err instanceof Error ? err.message : "Internal server error",
    });
  },
);

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(config.PORT, () => {
  console.log(`Infyro backend listening on http://localhost:${config.PORT}`);
  console.log(`WebSocket endpoint ws://localhost:${config.PORT}/ws`);
  console.log(`CORS origins: ${getAllowedOrigins().join(", ")}`);
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_USE_POLLING) {
    startTelegramPolling();
  } else if (config.TELEGRAM_BOT_TOKEN) {
    console.log(
      `Telegram webhook: POST http://localhost:${config.PORT}/webhooks/telegram`,
    );
  }
});
