import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
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
  createSession,
  createWsEventSink,
  handleConfirm,
  handleUserMessage,
  type AgentSession,
} from "../agent/orchestrator.js";
import { isOriginAllowed } from "../config.js";
import { supabase } from "../supabase.js";
import { parseClientMessage, type ServerMessage } from "./protocol.js";

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function createWebSocketServer(server: import("node:http").Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    if (!isOriginAllowed(request.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    let session: AgentSession | null = null;
    let authenticated = false;
    const sink = createWsEventSink(ws);

    ws.on("message", (data) => {
      void (async () => {
        const raw = typeof data === "string" ? data : data.toString("utf8");
        const message = parseClientMessage(raw);
        if (!message) {
          send(ws, { type: "error", message: "Invalid message format" });
          return;
        }

        if (message.type === "auth") {
          try {
            const { data: authData, error } = await supabase.auth.getUser(
              message.token,
            );
            if (error || !authData.user) {
              send(ws, {
                type: "auth_error",
                message: "Invalid or expired access token",
              });
              return;
            }

            const settings = await ensureAgentSettings(authData.user.id);
            let conversationId: string | null = null;
            let priorMessages: Array<{
              id: string;
              role: "user" | "assistant";
              content: string;
            }> = [];

            try {
              conversationId = await getOrCreateLatestConversation(
                authData.user.id,
                "web",
              );
              const stored = await loadConversationMessages(conversationId);
              priorMessages = stored
                .filter(
                  (row) => row.role === "user" || row.role === "assistant",
                )
                .map((row) => ({
                  id: row.id,
                  role: row.role as "user" | "assistant",
                  content: row.content,
                }));
            } catch (err) {
              console.warn("Failed to load conversation memory:", err);
            }

            session = await createSession(
              authData.user.id,
              settings.persona_prompt ?? "",
              {
                ...DEFAULT_TOOL_PERMISSIONS,
                ...(settings.tool_permissions ?? {}),
              },
              conversationId,
              mergeDefaults(settings.defaults),
              priorMessages.map(({ role, content }) => ({ role, content })),
            );
            authenticated = true;
            send(ws, {
              type: "history",
              messages: priorMessages,
            });
            send(ws, { type: "auth_ok" });
          } catch (err) {
            send(ws, {
              type: "auth_error",
              message:
                err instanceof Error ? err.message : "Authentication failed",
            });
          }
          return;
        }

        if (!authenticated || !session) {
          send(ws, {
            type: "auth_error",
            message: "Authenticate before sending messages",
          });
          return;
        }

        if (message.type === "user_message") {
          await handleUserMessage(session, message.content, sink);
          return;
        }

        if (message.type === "confirm") {
          await handleConfirm(session, message.approved, sink);
          return;
        }
      })().catch((err) => {
        console.error("WebSocket message handler error:", err);
        send(ws, {
          type: "error",
          message: err instanceof Error ? err.message : "Unexpected error",
        });
      });
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  return wss;
}
