import OpenAI from "openai";
import { config } from "../config.js";
import {
  getUserLlmKey,
  type LlmProvider,
} from "../db/llmKeys.js";

export type LlmRuntime = {
  client: OpenAI;
  provider: LlmProvider;
  lightModel: string;
  heavyModel: string;
  /** true when using the user's saved key */
  byok: boolean;
};

const OPENAI_LIGHT = "gpt-4o-mini";
const OPENAI_HEAVY = "gpt-4o";

export function createLlmClient(
  provider: LlmProvider,
  apiKey: string,
): OpenAI {
  if (provider === "openai") {
    return new OpenAI({ apiKey });
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

export function modelsForProvider(provider: LlmProvider): {
  lightModel: string;
  heavyModel: string;
} {
  if (provider === "openai") {
    return { lightModel: OPENAI_LIGHT, heavyModel: OPENAI_HEAVY };
  }
  return {
    lightModel: config.GROQ_MODEL_LIGHT,
    heavyModel: config.GROQ_MODEL_HEAVY,
  };
}

/**
 * Prefer the user's BYOK. Fall back to server GROQ_API_KEY when unset.
 */
export async function resolveLlmForUser(userId: string): Promise<LlmRuntime> {
  const row = await getUserLlmKey(userId);
  if (row?.api_key?.trim()) {
    const models = modelsForProvider(row.provider);
    return {
      client: createLlmClient(row.provider, row.api_key.trim()),
      provider: row.provider,
      ...models,
      byok: true,
    };
  }

  if (!config.GROQ_API_KEY?.trim()) {
    throw new Error(
      "No LLM API key configured. Add your OpenAI or Groq key in Settings → BYOK.",
    );
  }

  const models = modelsForProvider("groq");
  return {
    client: createLlmClient("groq", config.GROQ_API_KEY.trim()),
    provider: "groq",
    ...models,
    byok: false,
  };
}

/** @deprecated use resolveLlmForUser — kept for any leftover imports */
export const groq = createLlmClient("groq", config.GROQ_API_KEY || "missing");

export function getLightModel(): string {
  return config.GROQ_MODEL_LIGHT;
}

export function getHeavyModel(): string {
  return config.GROQ_MODEL_HEAVY;
}
