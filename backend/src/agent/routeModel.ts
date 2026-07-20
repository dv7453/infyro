import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { HIGH_RISK_TOOLS } from "../db/agentSettings.js";
import { TOOL_NAMES, isToolName } from "../tools/schemas.js";
import type { LlmRuntime } from "./llm.js";

const CLASSIFY_TIMEOUT_MS = 1500;

const CLASSIFY_SYSTEM = `You classify which agent tools might be needed for the user's latest message.
Call classify_tools once. Set plausible_tools to tool names from the allowed list that could apply.
Use [] if the user is only chatting / asking a question with no tool needed.
Do not invent tools. Do not answer the user.`;

/**
 * Existing agent tools require full argument objects, so they cannot cleanly
 * support "names only" classification. We force a single lightweight
 * classify_tools function whose enum is the same TOOL_NAMES list.
 */
const classifyTool = {
  type: "function" as const,
  function: {
    name: "classify_tools",
    description:
      "List which existing agent tools are plausibly relevant to the latest user message.",
    parameters: {
      type: "object",
      properties: {
        plausible_tools: {
          type: "array",
          items: {
            type: "string",
            enum: [...TOOL_NAMES],
          },
          description: "Zero or more tool names from the agent toolkit",
        },
      },
      required: ["plausible_tools"],
    },
  },
};

function recentContext(
  history: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
  const nonSystem = history.filter((m) => m.role !== "system");
  // Last ~3 turns ≈ up to 6 role messages (user/assistant pairs) + current
  return nonSystem.slice(-6).map((message) => {
    if (message.role === "tool") {
      return {
        role: "user" as const,
        content: "[tool result omitted]",
      };
    }
    if (message.role === "assistant" && "tool_calls" in message) {
      return {
        role: "assistant" as const,
        content:
          typeof message.content === "string"
            ? message.content
            : "[assistant tool call]",
      };
    }
    return {
      role: message.role as "user" | "assistant",
      content:
        typeof message.content === "string"
          ? message.content
          : String(message.content ?? ""),
    };
  });
}

async function classifyPlausibleTools(
  client: OpenAI,
  lightModel: string,
  history: ChatCompletionMessageParam[],
): Promise<string[]> {
  const completion = await client.chat.completions.create({
    model: lightModel,
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM },
      ...recentContext(history),
    ],
    tools: [classifyTool],
    tool_choice: {
      type: "function",
      function: { name: "classify_tools" },
    },
    stream: false,
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    return [];
  }

  const parsed = JSON.parse(call.function.arguments || "{}") as {
    plausible_tools?: unknown;
  };
  const list = Array.isArray(parsed.plausible_tools)
    ? parsed.plausible_tools
    : [];
  return list.filter(
    (name): name is string => typeof name === "string" && isToolName(name),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("classify_timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Pick light vs heavy model for this user turn.
 * Fail-safe: classification errors/timeouts → heavy.
 */
export async function selectModelForTurn(
  llm: LlmRuntime,
  history: ChatCompletionMessageParam[],
): Promise<string> {
  const light = llm.lightModel;
  const heavy = llm.heavyModel;

  try {
    const plausible = await withTimeout(
      classifyPlausibleTools(llm.client, light, history),
      CLASSIFY_TIMEOUT_MS,
    );
    const highRisk = plausible.some((name) => HIGH_RISK_TOOLS.includes(name));
    return highRisk ? heavy : light;
  } catch (err) {
    console.warn(
      "Model classification failed; defaulting to heavy:",
      err instanceof Error ? err.message : err,
    );
    return heavy;
  }
}
