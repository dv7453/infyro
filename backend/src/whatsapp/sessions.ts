import type { AgentSession } from "../agent/orchestrator.js";

/** In-memory WhatsApp sessions keyed by phone (same pendingToolCall pattern as WS). */
const sessionsByPhone = new Map<string, AgentSession>();

export function getWhatsAppSession(phone: string): AgentSession | undefined {
  return sessionsByPhone.get(normalizePhone(phone));
}

export function setWhatsAppSession(phone: string, session: AgentSession): void {
  sessionsByPhone.set(normalizePhone(phone), session);
}

export function clearWhatsAppSession(phone: string): void {
  sessionsByPhone.delete(normalizePhone(phone));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
