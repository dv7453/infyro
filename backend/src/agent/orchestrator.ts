import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type WebSocket from "ws";
import { logActivity } from "../db/activityLog.js";
import { persistMessage } from "../db/conversations.js";
import {
  EMPTY_DEFAULTS,
  HIGH_RISK_TOOLS,
  type DefaultsSettings,
  type ToolPermissions,
} from "../db/agentSettings.js";
import { executeTool } from "../tools/executors.js";
import {
  isToolName,
  openAiTools,
  validateToolArgs,
  type ToolName,
} from "../tools/schemas.js";
import { summarizeToolResult } from "../tools/summaries.js";
import type { ServerMessage } from "../ws/protocol.js";
import { trimHistoryForModel } from "./historyBudget.js";
import { resolveLlmForUser, type LlmRuntime } from "./llm.js";
import { buildSystemPrompt } from "./prompts.js";
import { selectModelForTurn } from "./routeModel.js";
import type { AgentEventSink } from "./sink.js";

export type { AgentEventSink } from "./sink.js";

export type PendingToolCall = {
  toolName: ToolName;
  args: Record<string, unknown>;
  toolCallId: string;
};

export type AgentSession = {
  userId: string;
  conversationId: string | null;
  personaPrompt: string;
  defaults: DefaultsSettings;
  toolPermissions: ToolPermissions;
  llm: LlmRuntime;
  history: ChatCompletionMessageParam[];
  pendingToolCall: PendingToolCall | null;
  busy: boolean;
};

function sendWs(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/** Maps orchestrator events to the existing WebSocket protocol. */
export function createWsEventSink(ws: WebSocket): AgentEventSink {
  return {
    onToken(content) {
      sendWs(ws, { type: "token", content });
    },
    onToolCallStarted(toolName) {
      sendWs(ws, { type: "tool_call_started", tool_name: toolName });
    },
    onToolResult(toolName, success, summary) {
      sendWs(ws, {
        type: "tool_result",
        tool_name: toolName,
        success,
        summary,
      });
    },
    onConfirmationRequired(toolName, params, summary) {
      sendWs(ws, {
        type: "confirmation_required",
        tool_name: toolName,
        params,
        summary,
      });
    },
    onMessageComplete() {
      sendWs(ws, { type: "message_complete" });
    },
    onError(message) {
      sendWs(ws, { type: "error", message });
    },
  };
}

function confirmationSummary(
  toolName: ToolName,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case "send_email":
      return `Send email to ${String(args.to)} with subject "${String(args.subject)}"?`;
    case "schedule_meeting":
      return `Schedule "${String(args.title ?? "Meeting")}" with ${String(args.attendee_email)} at ${String(args.start_time_iso)} for ${String(args.duration_minutes)} minutes?`;
    default:
      return `Run ${toolName} with the provided parameters?`;
  }
}

type StreamOutcome = {
  content: string;
  toolCalls: ChatCompletionMessageToolCall[];
};

async function streamCompletion(
  sink: AgentEventSink,
  session: AgentSession,
  history: ChatCompletionMessageParam[],
  model: string,
): Promise<StreamOutcome> {
  const messages = trimHistoryForModel(history);
  const stream = await session.llm.client.chat.completions.create({
    model,
    messages,
    tools: openAiTools,
    tool_choice: "auto",
    stream: true,
  });

  let content = "";
  const toolCallAccum = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      sink.onToken?.(delta.content);
    }

    if (delta.tool_calls) {
      for (const partial of delta.tool_calls) {
        const index = partial.index ?? 0;
        const existing = toolCallAccum.get(index) ?? {
          id: "",
          name: "",
          arguments: "",
        };
        if (partial.id) existing.id = partial.id;
        if (partial.function?.name) {
          existing.name += partial.function.name;
        }
        if (partial.function?.arguments) {
          existing.arguments += partial.function.arguments;
        }
        toolCallAccum.set(index, existing);
      }
    }
  }

  const toolCalls: ChatCompletionMessageToolCall[] = [...toolCallAccum.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => ({
      id: call.id || `tool_${call.name}`,
      type: "function" as const,
      function: {
        name: call.name,
        arguments: call.arguments || "{}",
      },
    }));

  return { content, toolCalls };
}

async function runToolAndContinue(
  sink: AgentEventSink,
  session: AgentSession,
  toolName: ToolName,
  args: Record<string, unknown>,
  toolCallId: string,
  model: string,
): Promise<void> {
  sink.onToolCallStarted?.(toolName);

  let success = true;
  let result: unknown;
  try {
    result = await executeTool(session.userId, toolName, args);
  } catch (err) {
    success = false;
    result = {
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }

  const summary = summarizeToolResult(toolName, success, result);
  sink.onToolResult?.(toolName, success, summary);

  logActivity(session.userId, toolName, args, result);

  session.history.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(result),
  });

  if (session.conversationId) {
    void persistMessage(
      session.conversationId,
      "tool",
      JSON.stringify({ tool_name: toolName, success, summary, result }),
    );
  }

  await streamFollowUp(sink, session, model);
}

async function streamFollowUp(
  sink: AgentEventSink,
  session: AgentSession,
  model: string,
): Promise<void> {
  const outcome = await streamCompletion(
    sink,
    session,
    session.history,
    model,
  );

  if (outcome.content) {
    session.history.push({ role: "assistant", content: outcome.content });
    if (session.conversationId) {
      await persistMessage(
        session.conversationId,
        "assistant",
        outcome.content,
      );
    }
  }

  if (outcome.toolCalls.length > 0) {
    session.history.push({
      role: "assistant",
      content: outcome.content || null,
      tool_calls: outcome.toolCalls,
    });
    await handleToolCalls(sink, session, outcome.toolCalls, model);
    return;
  }

  sink.onMessageComplete?.();
}

async function handleInvalidToolArgs(
  sink: AgentEventSink,
  session: AgentSession,
  toolCallId: string,
  fields: string[],
  model: string,
): Promise<void> {
  const errorPayload = { error: "missing_fields", fields };
  session.history.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(errorPayload),
  });

  await streamFollowUp(sink, session, model);
}

async function handleToolCalls(
  sink: AgentEventSink,
  session: AgentSession,
  toolCalls: ChatCompletionMessageToolCall[],
  model: string,
): Promise<void> {
  const call = toolCalls[0];
  if (!call || call.type !== "function") {
    sink.onMessageComplete?.();
    return;
  }

  const toolNameRaw = call.function.name;
  if (!isToolName(toolNameRaw)) {
    session.history.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify({ error: "unknown_tool", tool: toolNameRaw }),
    });
    await streamFollowUp(sink, session, model);
    return;
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(call.function.arguments || "{}");
  } catch {
    await handleInvalidToolArgs(sink, session, call.id, ["arguments"], model);
    return;
  }

  const validation = validateToolArgs(toolNameRaw, parsedArgs);
  if (!validation.ok) {
    await handleInvalidToolArgs(
      sink,
      session,
      call.id,
      validation.fields,
      model,
    );
    return;
  }

  const args = validation.data as Record<string, unknown>;
  const permission =
    session.toolPermissions[toolNameRaw] ??
    (HIGH_RISK_TOOLS.includes(toolNameRaw) ? "confirm" : "auto");

  if (permission === "confirm") {
    session.pendingToolCall = {
      toolName: toolNameRaw,
      args,
      toolCallId: call.id,
    };
    sink.onConfirmationRequired?.(
      toolNameRaw,
      args,
      confirmationSummary(toolNameRaw, args),
    );
    return;
  }

  await runToolAndContinue(sink, session, toolNameRaw, args, call.id, model);
}

export async function handleUserMessage(
  session: AgentSession,
  content: string,
  sink: AgentEventSink,
): Promise<void> {
  if (session.pendingToolCall) {
    sink.onError?.(
      "A tool confirmation is pending. Approve or cancel it first.",
    );
    return;
  }
  if (session.busy) {
    sink.onError?.("Agent is busy; wait for the current turn to finish.");
    return;
  }

  session.busy = true;
  try {
    // Pick up BYOK changes without forcing reconnect.
    session.llm = await resolveLlmForUser(session.userId);

    session.history.push({ role: "user", content });
    if (session.conversationId) {
      await persistMessage(session.conversationId, "user", content);
    }

    if (session.history[0]?.role !== "system") {
      session.history.unshift({
        role: "system",
        content: buildSystemPrompt(session.personaPrompt, session.defaults),
      });
    }

    // Invisible pre-step: route light vs heavy (no user-facing loading state)
    const model = await selectModelForTurn(session.llm, session.history);
    const outcome = await streamCompletion(
      sink,
      session,
      session.history,
      model,
    );

    if (outcome.toolCalls.length > 0) {
      session.history.push({
        role: "assistant",
        content: outcome.content || null,
        tool_calls: outcome.toolCalls,
      });
      if (outcome.content && session.conversationId) {
        await persistMessage(
          session.conversationId,
          "assistant",
          outcome.content,
        );
      }
      await handleToolCalls(sink, session, outcome.toolCalls, model);
      return;
    }

    if (outcome.content) {
      session.history.push({ role: "assistant", content: outcome.content });
      if (session.conversationId) {
        await persistMessage(
          session.conversationId,
          "assistant",
          outcome.content,
        );
      }
    }

    sink.onMessageComplete?.();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Agent turn failed";
    sink.onError?.(message);
  } finally {
    session.busy = false;
  }
}

export async function handleConfirm(
  session: AgentSession,
  approved: boolean,
  sink: AgentEventSink,
): Promise<void> {
  const pending = session.pendingToolCall;
  if (!pending) {
    sink.onError?.("No pending confirmation");
    return;
  }

  session.pendingToolCall = null;
  session.busy = true;

  try {
    session.llm = await resolveLlmForUser(session.userId);
    // Confirmations are always for high-risk tools — stay on heavy.
    const model = session.llm.heavyModel;

    if (!approved) {
      const cancelled = { error: "cancelled", message: "Cancelled by user" };
      sink.onToolResult?.(pending.toolName, false, "Cancelled by user");

      session.history.push({
        role: "tool",
        tool_call_id: pending.toolCallId,
        content: JSON.stringify(cancelled),
      });

      if (session.conversationId) {
        void persistMessage(
          session.conversationId,
          "tool",
          JSON.stringify({
            tool_name: pending.toolName,
            success: false,
            summary: "Cancelled by user",
          }),
        );
      }

      await streamFollowUp(sink, session, model);
      return;
    }

    await runToolAndContinue(
      sink,
      session,
      pending.toolName,
      pending.args,
      pending.toolCallId,
      model,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process confirmation";
    sink.onError?.(message);
  } finally {
    if (!session.pendingToolCall) {
      session.busy = false;
    }
  }
}

export async function createSession(
  userId: string,
  personaPrompt: string,
  toolPermissions: ToolPermissions,
  conversationId: string | null,
  defaults: DefaultsSettings = EMPTY_DEFAULTS,
  priorMessages: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<AgentSession> {
  const llm = await resolveLlmForUser(userId);
  return {
    userId,
    conversationId,
    personaPrompt,
    defaults,
    toolPermissions,
    llm,
    history: [
      {
        role: "system",
        content: buildSystemPrompt(personaPrompt, defaults),
      },
      ...priorMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    pendingToolCall: null,
    busy: false,
  };
}
