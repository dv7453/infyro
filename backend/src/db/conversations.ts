import { supabase } from "../supabase.js";

export type ConversationSource = "web" | "whatsapp" | "telegram";

export type StoredMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export async function createConversation(
  userId: string,
  source: ConversationSource = "web",
  externalKey: string | null = null,
): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      source,
      external_key: externalKey,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create conversation: ${error?.message ?? "unknown"}`,
    );
  }

  return data.id as string;
}

/**
 * Reuse the conversation that has the user's most recent chat messages
 * for the given channel source.
 */
export async function getOrCreateLatestConversation(
  userId: string,
  source: ConversationSource = "web",
  externalKey: string | null = null,
): Promise<string> {
  let query = supabase
    .from("conversations")
    .select("id, created_at, messages(id, role, created_at)")
    .eq("user_id", userId)
    .eq("source", source)
    .order("created_at", { ascending: false });

  if (
    (source === "whatsapp" || source === "telegram") &&
    externalKey
  ) {
    query = query.eq("external_key", externalKey);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load conversation: ${error.message}`);
  }

  const conversations = data ?? [];
  if (conversations.length === 0) {
    return createConversation(userId, source, externalKey);
  }

  let bestId: string | null = null;
  let bestMessageAt = -1;

  for (const conversation of conversations) {
    const messages = (
      (conversation.messages ?? []) as Array<{
        role: string;
        created_at: string;
      }>
    ).filter(
      (message) => message.role === "user" || message.role === "assistant",
    );

    for (const message of messages) {
      const at = new Date(message.created_at).getTime();
      if (at > bestMessageAt) {
        bestMessageAt = at;
        bestId = conversation.id as string;
      }
    }
  }

  if (bestId) {
    return bestId;
  }

  return conversations[0].id as string;
}

export async function loadConversationMessages(
  conversationId: string,
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (data ?? []) as StoredMessage[];
}

export async function persistMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
  });

  if (error) {
    console.error("Failed to persist message:", error.message);
  }
}
