import { supabase } from "../supabase.js";

export type GoogleTokenRow = {
  user_id: string;
  refresh_token: string;
  scopes: string[];
  updated_at: string;
};

export async function upsertGoogleTokens(
  userId: string,
  refreshToken: string,
  scopes: string[],
): Promise<void> {
  const { error } = await supabase.from("google_tokens").upsert(
    {
      user_id: userId,
      refresh_token: refreshToken,
      scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to store Google tokens: ${error.message}`);
  }
}

export async function getGoogleTokens(
  userId: string,
): Promise<GoogleTokenRow | null> {
  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google tokens: ${error.message}`);
  }

  return data as GoogleTokenRow | null;
}

export async function deleteGoogleTokens(userId: string): Promise<void> {
  const { error } = await supabase
    .from("google_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete Google tokens: ${error.message}`);
  }
}
