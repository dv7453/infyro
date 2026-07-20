import { OAUTH_SCOPES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "User",
  };
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function signInWithGoogle() {
  const origin = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: OAUTH_SCOPES,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
