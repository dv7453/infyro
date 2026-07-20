import { supabase } from "../supabase.js";

export function logActivity(
  userId: string,
  toolName: string,
  params: unknown,
  result: unknown,
): void {
  void supabase
    .from("activity_log")
    .insert({
      user_id: userId,
      tool_name: toolName,
      params: params ?? null,
      result: result ?? null,
    })
    .then(({ error }) => {
      if (error) {
        console.error("Failed to write activity_log:", error.message);
      }
    });
}
