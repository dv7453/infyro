import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAccessToken } from "@/lib/auth";
import { getWebSocketUrl } from "@/lib/constants";
import {
  parseIncomingMessage,
  sendMessage,
  type IncomingMessage,
} from "@/lib/websocket";
import {
  createId,
  type ChatItem,
  type ConnectionState,
} from "./chatTypes";

type ChatSessionValue = {
  items: ChatItem[];
  connectionState: ConnectionState;
  connectionError: string | null;
  awaitingResponse: boolean;
  pendingConfirmationId: string | null;
  sendUserMessage: (content: string) => void;
  confirmPending: (approved: boolean) => void;
  inputDisabled: boolean;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function useChatSession(): ChatSessionValue {
  const value = useContext(ChatSessionContext);
  if (!value) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return value;
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [pendingConfirmationId, setPendingConfirmationId] = useState<
    string | null
  >(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);
  const handleIncomingRef = useRef<(message: IncomingMessage) => void>(
    () => undefined,
  );

  handleIncomingRef.current = (message: IncomingMessage) => {
    switch (message.type) {
      case "auth_ok":
        setConnectionState("ready");
        setConnectionError(null);
        break;

      case "auth_error":
        setConnectionState("error");
        setConnectionError(message.message);
        break;

      case "history":
        if (historyLoadedRef.current) break;
        historyLoadedRef.current = true;
        setItems(
          message.messages.map((entry) =>
            entry.role === "user"
              ? {
                  kind: "user" as const,
                  id: entry.id,
                  content: entry.content,
                }
              : {
                  kind: "assistant" as const,
                  id: entry.id,
                  content: entry.content,
                  streaming: false,
                },
          ),
        );
        break;

      case "token":
        setItems((prev) => {
          const next = [...prev];
          const streamingId = streamingAssistantIdRef.current;

          if (streamingId) {
            const index = next.findIndex(
              (item) => item.kind === "assistant" && item.id === streamingId,
            );
            if (index !== -1 && next[index].kind === "assistant") {
              next[index] = {
                ...next[index],
                content: next[index].content + message.content,
              };
              return next;
            }
          }

          const newId = createId();
          streamingAssistantIdRef.current = newId;
          next.push({
            kind: "assistant",
            id: newId,
            content: message.content,
            streaming: true,
          });
          return next;
        });
        break;

      case "message_complete":
        if (streamingAssistantIdRef.current) {
          const completedId = streamingAssistantIdRef.current;
          streamingAssistantIdRef.current = null;
          setItems((prev) =>
            prev.map((item) =>
              item.kind === "assistant" && item.id === completedId
                ? { ...item, streaming: false }
                : item,
            ),
          );
        }
        setAwaitingResponse(false);
        break;

      case "tool_call_started":
        setItems((prev) => [
          ...prev,
          {
            kind: "tool",
            id: createId(),
            toolName: message.tool_name,
            status: "running",
          },
        ]);
        break;

      case "tool_result":
        setItems((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            const item = next[i];
            if (
              item.kind === "tool" &&
              item.toolName === message.tool_name &&
              item.status === "running"
            ) {
              next[i] = {
                ...item,
                status: "done",
                summary: message.summary,
                success: message.success,
              };
              break;
            }
          }
          return next;
        });
        break;

      case "confirmation_required": {
        const confirmationId = createId();
        setPendingConfirmationId(confirmationId);
        setAwaitingResponse(true);
        setItems((prev) => [
          ...prev,
          {
            kind: "confirmation",
            id: confirmationId,
            toolName: message.tool_name,
            params: message.params,
            summary: message.summary,
          },
        ]);
        break;
      }

      case "error":
        setItems((prev) => [
          ...prev,
          { kind: "error", id: createId(), message: message.message },
        ]);
        setAwaitingResponse(false);
        setPendingConfirmationId(null);
        streamingAssistantIdRef.current = null;
        break;
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        setConnectionState("error");
        setConnectionError("Not authenticated");
        return;
      }

      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnectionState("authenticating");
        sendMessage(ws, { type: "auth", token });
      };

      ws.onmessage = (event) => {
        const parsed = parseIncomingMessage(String(event.data));
        if (parsed) {
          handleIncomingRef.current(parsed);
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setConnectionState("error");
        setConnectionError("WebSocket connection failed");
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        setConnectionState("error");
        setConnectionError("Connection closed");
      };
    }

    void connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const sendUserMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      if (
        connectionState !== "ready" ||
        awaitingResponse ||
        pendingConfirmationId !== null
      ) {
        return;
      }

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      setItems((prev) => [
        ...prev,
        { kind: "user", id: createId(), content: trimmed },
      ]);
      setAwaitingResponse(true);
      streamingAssistantIdRef.current = null;
      sendMessage(ws, { type: "user_message", content: trimmed });
    },
    [awaitingResponse, connectionState, pendingConfirmationId],
  );

  const confirmPending = useCallback(
    (approved: boolean) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !pendingConfirmationId) {
        return;
      }

      sendMessage(ws, { type: "confirm", approved });
      setItems((prev) =>
        prev.map((item) =>
          item.kind === "confirmation" && item.id === pendingConfirmationId
            ? {
                ...item,
                resolved: approved ? "confirmed" : "cancelled",
              }
            : item,
        ),
      );
      setPendingConfirmationId(null);
    },
    [pendingConfirmationId],
  );

  const inputDisabled =
    connectionState !== "ready" ||
    awaitingResponse ||
    pendingConfirmationId !== null;

  const value = useMemo(
    () => ({
      items,
      connectionState,
      connectionError,
      awaitingResponse,
      pendingConfirmationId,
      sendUserMessage,
      confirmPending,
      inputDisabled,
    }),
    [
      items,
      connectionState,
      connectionError,
      awaitingResponse,
      pendingConfirmationId,
      sendUserMessage,
      confirmPending,
      inputDisabled,
    ],
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}
