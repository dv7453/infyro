import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getSessionUser, signInWithGoogle } from "@/lib/auth";
import logo from "@/assets/infyro-logo.png";

type SignInSearch = {
  error?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Infyro Agent" },
      {
        name: "description",
        content:
          "Connect your Google account to Infyro Agent, your AI assistant for email, meetings, and documents.",
      },
      { property: "og:title", content: "Sign in — Infyro Agent" },
      {
        property: "og:description",
        content:
          "Connect Google to unlock your AI agent for email, calendar, and Drive.",
      },
    ],
  }),
  component: SignInPage,
});

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.64-2.55C16.86 3.36 14.66 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.92 0 9.2-4.86 9.2-7.35 0-.5-.06-.87-.13-1.25H12z"
      />
    </svg>
  );
}

function SignInPage() {
  const navigate = useNavigate();
  const { error: searchError } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchError ?? null);

  useEffect(() => {
    if (searchError) setError(searchError);
  }, [searchError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!cancelled && user) {
        navigate({ to: "/agent" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSignIn = () => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await signInWithGoogle();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
        setLoading(false);
      }
    })();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(217,104,104,0.25), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(106,126,63,0.25), transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-border">
            <img
              src={logo}
              alt="Infyro"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="mt-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Infyro
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
            Infyro Agent
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Connect your Google account to get started with your AI assistant.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-tint/60 p-3 text-sm text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={onSignIn}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-70"
          >
            {loading ? (
              "Redirecting…"
            ) : (
              <>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                  <GoogleG className="h-3.5 w-3.5" />
                </span>
                Continue with Google
              </>
            )}
          </button>

          <ul className="mt-6 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Send email &amp; schedule meetings on your behalf
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Create documents &amp; save to Drive
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              You confirm sensitive actions before they run
            </li>
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}
