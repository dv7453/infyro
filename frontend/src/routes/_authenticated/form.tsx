import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircleHeart } from "lucide-react";
import { submitFeedback } from "@/lib/api";
import { getAccessToken, getSessionUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/form")({
  head: () => ({
    meta: [
      { title: "Form — Infyro" },
      {
        name: "description",
        content: "Share feedback and suggestions for the Infyro beta.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FormPage,
});

function FormPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!cancelled && user) {
        setEmail(user.email);
        if (user.name && user.name !== user.email) {
          setName(user.name);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      await submitFeedback(token, {
        name: name.trim(),
        message: message.trim(),
      });
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Form
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Suggestions and feedback for the Infyro beta.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                <MessageCircleHeart className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Thank you for trying Infyro
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Thank you very much for visiting the first beta version of
                  Infyro. If you have any suggestions, ideas, or add-ons you
                  would like to see, please let me know — your feedback helps
                  shape what comes next.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Your registered email
                </label>
                <div className="mt-1.5 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground">
                  {email ?? "Loading…"}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Saved with your message so we can follow up if needed.
                </p>
              </div>

              <div>
                <label
                  htmlFor="feedback-name"
                  className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                >
                  Name
                </label>
                <input
                  id="feedback-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSent(false);
                  }}
                  required
                  maxLength={120}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label
                  htmlFor="feedback-message"
                  className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                >
                  Message
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setSent(false);
                  }}
                  required
                  rows={6}
                  maxLength={5000}
                  className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Share a suggestion, bug, or idea…"
                />
              </div>

              {error && <p className="text-xs text-primary">{error}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={sending || !name.trim() || !message.trim()}
                  className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
                {sent && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                    <Check className="h-3.5 w-3.5" />
                    Thanks — your message was saved.
                  </span>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
