export type ChatItem =
  | { kind: "user"; id: string; content: string }
  | { kind: "assistant"; id: string; content: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      toolName: string;
      status: "running" | "done";
      summary?: string;
      success?: boolean;
    }
  | {
      kind: "confirmation";
      id: string;
      toolName: string;
      params: Record<string, unknown>;
      summary: string;
      resolved?: "confirmed" | "cancelled";
    }
  | { kind: "error"; id: string; message: string };

export type ConnectionState =
  | "connecting"
  | "authenticating"
  | "ready"
  | "error";

export function createId() {
  return crypto.randomUUID();
}
