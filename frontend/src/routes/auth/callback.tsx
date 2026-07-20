import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storeTokens } from "@/lib/api";
import { OAUTH_SCOPES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/infyro-logo.png";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing in — Infyro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const url = new URL(window.location.href);
      const errorParam =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error");
      const code = url.searchParams.get("code");

      if (errorParam) {
        navigate({
          to: "/",
          search: { error: errorParam },
        });
        return;
      }

      if (!code) {
        navigate({
          to: "/",
          search: { error: "Missing authorization code" },
        });
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error || !data.session) {
        navigate({
          to: "/",
          search: {
            error: error?.message ?? "Failed to exchange code for session",
          },
        });
        return;
      }

      const providerRefreshToken = data.session.provider_refresh_token;
      if (!providerRefreshToken) {
        navigate({
          to: "/",
          search: {
            error:
              "Google did not return a refresh token. Try signing in again.",
          },
        });
        return;
      }

      try {
        setMessage("Connecting your Google account…");
        await storeTokens(
          data.session.access_token,
          providerRefreshToken,
          OAUTH_SCOPES,
        );
        if (cancelled) return;
        navigate({ to: "/agent" });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to store provider tokens";
        navigate({ to: "/", search: { error: msg } });
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-background px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-border">
        <img src={logo} alt="Infyro" className="h-full w-full object-contain" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
