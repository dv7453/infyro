import { randomInt } from "node:crypto";
import { supabase } from "../supabase.js";

export type TelegramLink = {
  chat_id: string;
  user_id: string;
  telegram_username: string | null;
  linked_at: string;
};

export type TelegramLinkCode = {
  code: string;
  user_id: string;
  expires_at: string;
  used: boolean;
};

export async function getLinkByChatId(
  chatId: string,
): Promise<TelegramLink | null> {
  const { data, error } = await supabase
    .from("telegram_links")
    .select("*")
    .eq("chat_id", String(chatId))
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Telegram link: ${error.message}`);
  }
  return data as TelegramLink | null;
}

export async function getLinkByUserId(
  userId: string,
): Promise<TelegramLink | null> {
  const { data, error } = await supabase
    .from("telegram_links")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Telegram link: ${error.message}`);
  }
  return data as TelegramLink | null;
}

export async function createLink(
  chatId: string,
  userId: string,
  telegramUsername: string | null = null,
): Promise<void> {
  const { error } = await supabase.from("telegram_links").upsert(
    {
      chat_id: String(chatId),
      user_id: userId,
      telegram_username: telegramUsername,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" },
  );

  if (error) {
    throw new Error(`Failed to create Telegram link: ${error.message}`);
  }
}

export async function deleteLinkByUserId(userId: string): Promise<void> {
  const { error } = await supabase
    .from("telegram_links")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to unlink Telegram: ${error.message}`);
  }
}

export async function generateLinkCode(
  userId: string,
): Promise<{ code: string; expires_at: string }> {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("telegram_link_codes").insert({
    code,
    user_id: userId,
    expires_at: expiresAt,
    used: false,
  });

  if (error) {
    throw new Error(`Failed to create link code: ${error.message}`);
  }

  return { code, expires_at: expiresAt };
}

export async function findValidLinkCode(
  code: string,
): Promise<TelegramLinkCode | null> {
  const normalized = code.trim();
  const { data, error } = await supabase
    .from("telegram_link_codes")
    .select("*")
    .eq("code", normalized)
    .eq("used", false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up link code: ${error.message}`);
  }
  if (!data) return null;

  const row = data as TelegramLinkCode;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row;
}

export async function markLinkCodeUsed(code: string): Promise<void> {
  const { error } = await supabase
    .from("telegram_link_codes")
    .update({ used: true })
    .eq("code", code);

  if (error) {
    throw new Error(`Failed to mark link code used: ${error.message}`);
  }
}
