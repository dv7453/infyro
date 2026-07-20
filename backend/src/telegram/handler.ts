import {
  createSession,
  handleConfirm,
  handleUserMessage,
  type AgentEventSink,
  type AgentSession,
} from "../agent/orchestrator.js";
import {
  DEFAULT_TOOL_PERMISSIONS,
  ensureAgentSettings,
  mergeDefaults,
} from "../db/agentSettings.js";
import {
  getOrCreateLatestConversation,
  loadConversationMessages,
} from "../db/conversations.js";
import {
  createLink,
  findValidLinkCode,
  getLinkByChatId,
  markLinkCodeUsed,
} from "../db/telegram.js";
import { config } from "../config.js";
import { sendTelegramMessage } from "./send.js";
import {
  getTelegramSession,
  setTelegramSession,
} from "./sessions.js";

const YES = new Set(["yes", "y", "confirm"]);
const NO = new Set(["no", "n", "cancel"]);

function parseYesNo(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();
  if (YES.has(normalized)) return true;
  if (NO.has(normalized)) return false;
  return null;
}

function extractLinkCode(text: string): string | null {
  const trimmed = text.trim();
  const startMatch = trimmed.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  if (startMatch) {
    const payload = (startMatch[1] ?? "").trim();
    if (/^\d{6}$/.test(payload)) return payload;
    return null;
  }
  const codeMatch = trimmed.match(/\b(\d{6})\b/);
  if (codeMatch) return codeMatch[1] ?? null;
  if (/^\d{6}$/.test(trimmed)) return trimmed;
  return null;
}

function createTelegramSink(chatId: string): {
  sink: AgentEventSink;
  flushFinalReply: () => Promise<void>;
} {
  let pendingReply = "";
  let confirmationSent = false;

  const sink: AgentEventSink = {
    onToken(content) {
      pendingReply += content;
    },
    onToolCallStarted() {},
    onToolResult() {},
    onConfirmationRequired(_toolName, _params, summary) {
      confirmationSent = true;
      void sendTelegramMessage(
        chatId,
        `${summary}\n\nReply yes or no to continue.`,
      ).catch((err) => console.error("Telegram confirm prompt failed:", err));
    },
    onMessageComplete() {},
    onError(message) {
      void sendTelegramMessage(chatId, message).catch((err) =>
        console.error("Telegram error send failed:", err),
      );
    },
  };

  async function flushFinalReply() {
    if (confirmationSent) return;
    const text = pendingReply.trim();
    if (text) {
      await sendTelegramMessage(chatId, text);
    }
  }

  return { sink, flushFinalReply };
}

async function loadOrCreateSession(
  chatId: string,
  userId: string,
): Promise<AgentSession> {
  const existing = getTelegramSession(chatId);
  if (existing && existing.userId === userId) {
    return existing;
  }

  const settings = await ensureAgentSettings(userId);
  const conversationId = await getOrCreateLatestConversation(
    userId,
    "telegram",
    chatId,
  );
  const stored = await loadConversationMessages(conversationId);
  const priorMessages = stored
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  const session = await createSession(
    userId,
    settings.persona_prompt ?? "",
    {
      ...DEFAULT_TOOL_PERMISSIONS,
      ...(settings.tool_permissions ?? {}),
    },
    conversationId,
    mergeDefaults(settings.defaults),
    priorMessages,
  );
  setTelegramSession(chatId, session);
  return session;
}

export async function processTelegramIncoming(params: {
  chatId: string;
  text: string | null;
  username: string | null;
}): Promise<void> {
  const chatId = String(params.chatId);

  if (params.text == null) {
    await sendTelegramMessage(
      chatId,
      "I can only read text messages right now.",
    );
    return;
  }

  const text = params.text.trim();
  const link = await getLinkByChatId(chatId);

  if (!link) {
    const code = extractLinkCode(text);
    if (code) {
      const row = await findValidLinkCode(code);
      if (row) {
        await createLink(chatId, row.user_id, params.username);
        await markLinkCodeUsed(code);
        await sendTelegramMessage(
          chatId,
          "Connected! You can now chat with your Infyro agent here.",
        );
        return;
      }
      await sendTelegramMessage(
        chatId,
        "That code is invalid or expired. Generate a new one in Infyro Settings → Telegram.",
      );
      return;
    }

    const bot = config.TELEGRAM_BOT_USERNAME
      ? `@${config.TELEGRAM_BOT_USERNAME.replace(/^@/, "")}`
      : "this bot";
    await sendTelegramMessage(
      chatId,
      `This Telegram chat isn't linked yet. Open Infyro Settings → Telegram, get a 6-digit code, then send it here (or tap the deep link).\n\nBot: ${bot}`,
    );
    return;
  }

  // Ignore bare /start after already linked
  if (/^\/start(?:@\w+)?(?:\s+.*)?$/i.test(text)) {
    await sendTelegramMessage(
      chatId,
      "You're already connected. Send a message to chat with your agent.",
    );
    return;
  }

  const session = await loadOrCreateSession(chatId, link.user_id);
  const { sink, flushFinalReply } = createTelegramSink(chatId);

  if (session.pendingToolCall) {
    const answer = parseYesNo(text);
    if (answer === null) {
      await sendTelegramMessage(chatId, "Reply yes or no");
      return;
    }
    await handleConfirm(session, answer, sink);
    await flushFinalReply();
    setTelegramSession(chatId, session);
    return;
  }

  await handleUserMessage(session, text, sink);
  await flushFinalReply();
  setTelegramSession(chatId, session);
}
