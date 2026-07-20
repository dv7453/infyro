import { Router } from "express";
import { config } from "../config.js";
import { processWhatsAppIncoming } from "../whatsapp/handler.js";

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    typeof token === "string" &&
    token === config.WHATSAPP_VERIFY_TOKEN &&
    typeof challenge === "string"
  ) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }

  res.status(403).send("Forbidden");
});

type WhatsAppWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

whatsappWebhookRouter.post("/", (req, res) => {
  // Acknowledge immediately — process agent work asynchronously.
  res.status(200).json({ ok: true });

  const body = req.body as WhatsAppWebhookBody;
  if (body.object !== "whatsapp_business_account") {
    return;
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from) continue;
        void processWhatsAppIncoming({
          from: message.from,
          type: message.type ?? "unknown",
          text: message.text?.body ?? null,
        }).catch((err) => {
          console.error("WhatsApp message processing failed:", err);
        });
      }
    }
  }
});
