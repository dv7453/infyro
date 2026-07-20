import type { AgentSession } from "../agent/orchestrator.js";

/** In-memory Telegram sessions keyed by chat_id. */
const sessionsByChat = new Map<string, AgentSession>();

export function getTelegramSession(chatId: string): AgentSession | undefined {
  return sessionsByChat.get(String(chatId));
}

export function setTelegramSession(
  chatId: string,
  session: AgentSession,
): void {
  sessionsByChat.set(String(chatId), session);
}

export function clearTelegramSession(chatId: string): void {
  sessionsByChat.delete(String(chatId));
}
