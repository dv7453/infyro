import { supabase } from "../supabase.js";

export type LlmProvider = "groq" | "openai";

export type UserLlmKeyRow = {
  user_id: string;
  provider: LlmProvider;
  api_key: string;
  updated_at: string;
};

export function isLlmProvider(value: string): value is LlmProvider {
  return value === "groq" || value === "openai";
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

export async function getUserLlmKey(
  userId: string,
): Promise<UserLlmKeyRow | null> {
  const { data, error } = await supabase
    .from("user_llm_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load LLM key: ${error.message}`);
  }
  return data as UserLlmKeyRow | null;
}

export async function upsertUserLlmKey(
  userId: string,
  provider: LlmProvider,
  apiKey: string,
): Promise<UserLlmKeyRow> {
  const { data, error } = await supabase
    .from("user_llm_keys")
    .upsert(
      {
        user_id: userId,
        provider,
        api_key: apiKey.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save LLM key: ${error?.message ?? "unknown"}`,
    );
  }
  return data as UserLlmKeyRow;
}

/** Update provider only, keep existing key. */
export async function updateUserLlmProvider(
  userId: string,
  provider: LlmProvider,
): Promise<UserLlmKeyRow> {
  const existing = await getUserLlmKey(userId);
  if (!existing) {
    throw new Error("No API key saved yet — paste a key to save");
  }
  return upsertUserLlmKey(userId, provider, existing.api_key);
}

export async function deleteUserLlmKey(userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_llm_keys")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clear LLM key: ${error.message}`);
  }
}
