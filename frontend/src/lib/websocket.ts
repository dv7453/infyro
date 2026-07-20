export type OutgoingMessage =
  | { type: "auth"; token: string }
  | { type: "user_message"; content: string }
  | { type: "confirm"; approved: boolean };

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type IncomingMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; message: string }
  | { type: "history"; messages: HistoryMessage[] }
  | { type: "token"; content: string }
  | { type: "message_complete" }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_result";
      tool_name: string;
      success: boolean;
      summary: string;
    }
  | {
      type: "confirmation_required";
      tool_name: string;
      params: Record<string, unknown>;
      summary: string;
    }
  | { type: "error"; message: string };

export function parseIncomingMessage(data: string): IncomingMessage | null {
  try {
    const parsed = JSON.parse(data) as IncomingMessage;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function sendMessage(ws: WebSocket, message: OutgoingMessage): void {
  ws.send(JSON.stringify(message));
}
