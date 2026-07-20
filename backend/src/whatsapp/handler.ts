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
  getLinkByPhone,
  markLinkCodeUsed,
} from "../db/whatsapp.js";
import { config } from "../config.js";
import { sendWhatsAppMessage } from "./send.js";
import {
  getWhatsAppSession,
  normalizePhone,
  setWhatsAppSession,
} from "./sessions.js";

const YES = new Set(["yes", "y", "confirm"]);
const NO = new Set(["no", "n", "cancel"]);

function parseYesNo(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();
  if (YES.has(normalized)) return true;
  if (NO.has(normalized)) return false;
  return null;
}

function createWhatsAppSink(phone: string): {
  sink: AgentEventSink;
  flushFinalReply: () => Promise<void>;
} {
  let pendingReply = "";
  let confirmationSent = false;

  const sink: AgentEventSink = {
    onToken(content) {
      pendingReply += content;
    },
    onToolCallStarted() {
      // Noisy over WhatsApp — skip
    },
    onToolResult() {
      // Included in final model follow-up
    },
    onConfirmationRequired(_toolName, _params, summary) {
      confirmationSent = true;
      void sendWhatsAppMessage(
        phone,
        `${summary}\n\nReply yes or no to continue.`,
      ).catch((err) => console.error("WhatsApp confirm prompt failed:", err));
    },
    onMessageComplete() {
      // flushed by caller after handleUserMessage / handleConfirm
    },
    onError(message) {
      void sendWhatsAppMessage(phone, message).catch((err) =>
        console.error("WhatsApp error send failed:", err),
      );
    },
  };

  async function flushFinalReply() {
    if (confirmationSent) return;
    const text = pendingReply.trim();
    if (text) {
      await sendWhatsAppMessage(phone, text);
    }
  }

  return { sink, flushFinalReply };
}

async function loadOrCreateSession(
  phone: string,
  userId: string,
): Promise<AgentSession> {
  const existing = getWhatsAppSession(phone);
  if (existing && existing.userId === userId) {
    return existing;
  }

  const settings = await ensureAgentSettings(userId);
  const conversationId = await getOrCreateLatestConversation(
    userId,
    "whatsapp",
    phone,
  );
  const stored = await loadConversationMessages(conversationId);
  const priorMessages = stored
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  const session = createSession(
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
  setWhatsAppSession(phone, session);
  return session;
}

export async function processWhatsAppIncoming(params: {
  from: string;
  text: string | null;
  type: string;
}): Promise<void> {
  const phone = normalizePhone(params.from);

  if (params.type !== "text" || params.text == null) {
    await sendWhatsAppMessage(
      phone,
      "I can only read text messages right now.",
    );
    return;
  }

  const text = params.text.trim();
  const link = await getLinkByPhone(phone);

  if (!link) {
    const codeMatch = text.match(/\b(\d{6})\b/);
    const code = codeMatch?.[1] ?? ( /^\d{6}$/.test(text) ? text : null);

    if (code) {
      const row = await findValidLinkCode(code);
      if (row) {
        await createLink(phone, row.user_id);
        await markLinkCodeUsed(code);
        await sendWhatsAppMessage(
          phone,
          "Connected! You can now chat with your agent here.",
        );
        return;
      }
    }

    const business = config.WHATSAPP_BUSINESS_NUMBER || "this WhatsApp number";
    await sendWhatsAppMessage(
      phone,
      `This WhatsApp isn't linked yet. Open Infyro Settings → Connect WhatsApp, get a 6-digit code, and text that code to ${business}.`,
    );
    return;
  }

  const session = await loadOrCreateSession(phone, link.user_id);
  const { sink, flushFinalReply } = createWhatsAppSink(phone);

  if (session.pendingToolCall) {
    const answer = parseYesNo(text);
    if (answer === null) {
      await sendWhatsAppMessage(phone, "Reply yes or no");
      return;
    }
    await handleConfirm(session, answer, sink);
    await flushFinalReply();
    setWhatsAppSession(phone, session);
    return;
  }

  await handleUserMessage(session, text, sink);
  await flushFinalReply();
  setWhatsAppSession(phone, session);
}
