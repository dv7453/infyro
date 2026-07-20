import { Router } from "express";
import {
  deleteLinkByUserId,
  generateLinkCode,
  getLinkByUserId,
} from "../db/whatsapp.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { config } from "../config.js";
import { clearWhatsAppSession } from "../whatsapp/sessions.js";

export const whatsappSettingsRouter = Router();

whatsappSettingsRouter.post("/generate-code", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const result = await generateLinkCode(user.id);
    res.json({
      code: result.code,
      expires_at: result.expires_at,
      business_number: config.WHATSAPP_BUSINESS_NUMBER || null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate code";
    res.status(500).json({ message });
  }
});

whatsappSettingsRouter.get("/status", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const link = await getLinkByUserId(user.id);
    res.json({
      linked: Boolean(link),
      phone_number: link?.phone_number ?? null,
      business_number: config.WHATSAPP_BUSINESS_NUMBER || null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load WhatsApp status";
    res.status(500).json({ message });
  }
});

whatsappSettingsRouter.post("/unlink", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const link = await getLinkByUserId(user.id);
    if (link) {
      clearWhatsAppSession(link.phone_number);
    }
    await deleteLinkByUserId(user.id);
    res.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to unlink WhatsApp";
    res.status(500).json({ message });
  }
});
