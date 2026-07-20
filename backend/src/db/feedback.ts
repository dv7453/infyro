import { supabase } from "../supabase.js";

export type FeedbackRow = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  message: string;
  created_at: string;
};

export async function insertFeedback(input: {
  userId: string;
  email: string;
  name: string;
  message: string;
}): Promise<FeedbackRow> {
  const { data, error } = await supabase
    .from("feedback_messages")
    .insert({
      user_id: input.userId,
      email: input.email,
      name: input.name,
      message: input.message,
    })
    .select("id, user_id, email, name, message, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save feedback");
  }

  return data as FeedbackRow;
}
