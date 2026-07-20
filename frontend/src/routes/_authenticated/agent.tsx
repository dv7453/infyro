import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Send,
  AlertCircle,
  Check,
  Loader2,
  Sparkles,
  Mail,
  CalendarClock,
  FileText,
} from "lucide-react";
import { useChatSession } from "@/components/agent/ChatSessionProvider";
import type { ChatItem } from "@/components/agent/chatTypes";
import {
  getSpeechRecognitionConstructor,
  type SpeechRecognitionLike,
} from "@/lib/speechRecognition";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({
    meta: [
      { title: "Agent — Infyro" },
      {
        name: "description",
        content: "Chat with your Infyro AI agent to run tasks across Google.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentPage,
});

const SUGGESTIONS = [
  { icon: Mail, label: "Draft an email to my team about Q3 goals" },
  { icon: CalendarClock, label: "Schedule a 30-min sync with Priya tomorrow" },
  { icon: FileText, label: "Create a project brief in Google Docs" },
];

function AgentPage() {
  const {
    items,
    connectionState,
    connectionError,
    awaitingResponse,
    sendUserMessage,
    confirmPending,
    inputDisabled,
    pendingConfirmationId,
  } = useChatSession();

  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const baseInputRef = useRef("");
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function stopListening() {
    listeningRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }

  function startListening() {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor || inputDisabled) {
      if (!SpeechRecognitionCtor) {
        setMicError("Voice input isn't supported in this browser.");
      }
      return;
    }

    setMicError(null);
    baseInputRef.current = input;
    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += piece;
        } else {
          interim += piece;
        }
      }

      const base = baseInputRef.current;
      const finals = finalTranscriptRef.current;
      const spacer =
        base && !base.endsWith(" ") && (finals || interim) ? " " : "";
      setInput(`${base}${spacer}${finals}${interim}`);
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicError("Mic access denied");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setMicError("Mic error — try again");
      }
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setMicError("Could not start mic");
    }
  }

  function toggleMic() {
    if (listeningRef.current) {
      stopListening();
      return;
    }
    startListening();
  }

  function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || inputDisabled) return;
    stopListening();
    sendUserMessage(value);
    setInput("");
  }

  function resolveConfirm(approved: boolean) {
    confirmPending(approved);
  }

  const status =
    connectionState === "ready"
      ? "ready"
      : connectionState === "error"
        ? "error"
        : connectionState === "authenticating"
          ? "auth"
          : "connecting";

  const statusText =
    status === "connecting"
      ? "Connecting…"
      : status === "auth"
        ? "Authenticating…"
        : status === "error"
          ? (connectionError ?? "Connection error")
          : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Agent
            </h1>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">
              {status === "ready" ? "Live" : "Offline"}
            </span>
          </div>
          {statusText && (
            <p
              className={
                "mt-0.5 text-xs " +
                (status === "error" ? "text-primary" : "text-muted-foreground")
              }
            >
              {statusText}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={
              "h-2 w-2 rounded-full " +
              (status === "ready" ? "bg-accent" : "bg-muted-foreground")
            }
          />
          {status === "ready" ? "Google connected" : "Waiting for connection"}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
          {items.length === 0 ? (
            <EmptyState onPick={send} disabled={inputDisabled} />
          ) : (
            items.map((m) => (
              <MessageView
                key={m.id}
                m={m}
                onConfirm={resolveConfirm}
                canConfirm={
                  m.kind === "confirmation" &&
                  !m.resolved &&
                  m.id === pendingConfirmationId
                }
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                awaitingResponse
                  ? "Waiting for response…"
                  : listening
                    ? "Listening…"
                    : "Type a message…"
              }
              disabled={inputDisabled && !listening}
              className="max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={toggleMic}
              disabled={inputDisabled && !listening}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              className={
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors " +
                (listening
                  ? "bg-primary text-primary-foreground mic-pulse"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={() => send()}
              disabled={!input.trim() || inputDisabled}
              aria-label="Send message"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {micError && (
            <p className="mt-2 pl-2 text-xs text-primary">{micError}</p>
          )}
          <p className="mt-2 pl-2 text-[11px] text-muted-foreground">
            Sensitive actions require your confirmation before they run.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        How can I help today?
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Send a message to start chatting with your agent. Try one of these:
      </p>
      <div className="mt-6 flex w-full max-w-md flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.label)}
            disabled={disabled}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-tint/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="flex-1">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({
  m,
  onConfirm,
  canConfirm,
}: {
  m: ChatItem;
  onConfirm: (approved: boolean) => void;
  canConfirm: boolean;
}) {
  if (m.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {m.content}
        </div>
      </div>
    );
  }
  if (m.kind === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm whitespace-pre-wrap">
          {m.content}
          {m.streaming && (
            <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 rounded-sm bg-primary caret-blink" />
          )}
        </div>
      </div>
    );
  }
  if (m.kind === "tool") {
    const failed = m.status === "done" && m.success === false;
    return (
      <div className="flex justify-start">
        <div className="inline-flex max-w-[80%] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-sm">
          {m.status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : failed ? (
            <AlertCircle className="h-3.5 w-3.5 text-primary" />
          ) : (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Check className="h-3 w-3" />
            </span>
          )}
          <span className="font-medium">
            {m.status === "running" ? "Working" : failed ? "Failed" : "Done"}:{" "}
            {m.toolName}
          </span>
          {m.summary && (
            <span className="text-muted-foreground">— {m.summary}</span>
          )}
        </div>
      </div>
    );
  }
  if (m.kind === "confirmation") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[85%] rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="text-[10px] font-semibold tracking-wider text-primary uppercase">
            Confirmation required — {m.toolName}
          </div>
          <p className="mt-2 text-sm text-foreground">{m.summary}</p>
          {m.resolved ? (
            <div className="mt-3 text-xs font-medium text-accent">
              {m.resolved === "confirmed" ? "Confirmed" : "Cancelled"}
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onConfirm(true)}
                disabled={!canConfirm}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => onConfirm(false)}
                disabled={!canConfirm}
                className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[80%] items-start gap-2 rounded-2xl border border-primary/20 bg-primary-tint/60 px-4 py-3 text-sm text-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
        <span>{m.message}</span>
      </div>
    </div>
  );
}
