import { randomInt } from "node:crypto";
import { supabase } from "../supabase.js";

export type WhatsAppLink = {
  phone_number: string;
  user_id: string;
  linked_at: string;
};

export type WhatsAppLinkCode = {
  code: string;
  user_id: string;
  expires_at: string;
  used: boolean;
};

export async function getLinkByPhone(
  phoneNumber: string,
): Promise<WhatsAppLink | null> {
  const { data, error } = await supabase
    .from("whatsapp_links")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load WhatsApp link: ${error.message}`);
  }
  return data as WhatsAppLink | null;
}

export async function getLinkByUserId(
  userId: string,
): Promise<WhatsAppLink | null> {
  const { data, error } = await supabase
    .from("whatsapp_links")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load WhatsApp link: ${error.message}`);
  }
  return data as WhatsAppLink | null;
}

export async function createLink(
  phoneNumber: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("whatsapp_links").upsert(
    {
      phone_number: phoneNumber,
      user_id: userId,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );

  if (error) {
    throw new Error(`Failed to create WhatsApp link: ${error.message}`);
  }
}

export async function deleteLinkByUserId(userId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_links")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to unlink WhatsApp: ${error.message}`);
  }
}

export async function generateLinkCode(
  userId: string,
): Promise<{ code: string; expires_at: string }> {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("whatsapp_link_codes").insert({
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
): Promise<WhatsAppLinkCode | null> {
  const normalized = code.trim();
  const { data, error } = await supabase
    .from("whatsapp_link_codes")
    .select("*")
    .eq("code", normalized)
    .eq("used", false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up link code: ${error.message}`);
  }
  if (!data) return null;

  const row = data as WhatsAppLinkCode;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row;
}

export async function markLinkCodeUsed(code: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_link_codes")
    .update({ used: true })
    .eq("code", code);

  if (error) {
    throw new Error(`Failed to mark link code used: ${error.message}`);
  }
}
