import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/** Leave headroom under Groq free-tier ~8k TPM (tools + reply also count). */
const MAX_HISTORY_TOKENS = 4500;
const MAX_TOOL_CONTENT_CHARS = 1200;

function estimateTokens(text: string): number {
  // Rough GPT-style heuristic; good enough for budgeting.
  return Math.ceil(text.length / 4);
}

function messageText(message: ChatCompletionMessageParam): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if ("tool_calls" in message && message.tool_calls) {
    return JSON.stringify(message.tool_calls);
  }
  return "";
}

function shrinkToolContent(content: string): string {
  if (content.length <= MAX_TOOL_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_TOOL_CONTENT_CHARS)}…[truncated]`;
}

function sanitizeMessage(
  message: ChatCompletionMessageParam,
): ChatCompletionMessageParam {
  if (message.role === "tool" && typeof message.content === "string") {
    return { ...message, content: shrinkToolContent(message.content) };
  }
  if (
    message.role === "assistant" &&
    typeof message.content === "string" &&
    message.content.length > MAX_TOOL_CONTENT_CHARS * 2
  ) {
    return {
      ...message,
      content: `${message.content.slice(0, MAX_TOOL_CONTENT_CHARS * 2)}…[truncated]`,
    };
  }
  return message;
}

/**
 * Keep system prompt + newest turns under a token budget so Groq TPM limits
 * are not exceeded on long chats.
 */
export function trimHistoryForModel(
  history: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
  if (history.length === 0) return history;

  const sanitized = history.map(sanitizeMessage);
  const system = sanitized.filter((m) => m.role === "system");
  const rest = sanitized.filter((m) => m.role !== "system");

  const systemTokens = system.reduce(
    (sum, m) => sum + estimateTokens(messageText(m)),
    0,
  );
  let budget = Math.max(500, MAX_HISTORY_TOKENS - systemTokens);

  const kept: ChatCompletionMessageParam[] = [];
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const msg = rest[i];
    const cost = estimateTokens(messageText(msg)) + 8;
    if (kept.length > 0 && cost > budget) {
      break;
    }
    kept.unshift(msg);
    budget -= cost;
  }

  // Drop orphan tool messages at the start (need preceding assistant tool_calls)
  while (kept.length > 0 && kept[0].role === "tool") {
    kept.shift();
  }

  return [...system, ...kept];
}
