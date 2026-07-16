import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { TID } from "@/lib/testIds";

export default function Verify() {
  const navigate = useNavigate();
  const phone = useStore((s) => s.phone);
  const countryCode = useStore((s) => s.countryCode);
  const pendingOtp = useStore((s) => s.pendingOtp);
  const otpMeta = useStore((s) => s.otpMeta);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  if (!phone) return <Navigate to="/login" replace />;

  const onDigit = (i, raw) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError("");
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length < 2) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    setError("");
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const goAfterAuth = (res) => {
    if (res.next_step === "dashboard" || res.user?.profile_complete) navigate("/");
    else navigate("/welcome/name");
  };

  const submit = async (e) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const res = await actions.verifyOtp(code);
      goAfterAuth(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t verify. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await actions.resendOtp();
      setSeconds(30);
      setDigits(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t resend. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const viaTelegram = otpMeta?.deliveredVia === "telegram";

  return (
    <StepShell
      bottom={
        <Button
          onClick={submit}
          disabled={busy || digits.join("").length !== 6}
          data-testid={TID.verifyContinueBtn}
          className="w-full h-14 rounded-full text-base font-medium"
        >
          {busy ? "Checking…" : "Verify"}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            Enter your code
          </h1>
          <p className="mt-3 text-muted-foreground">
            Sent to {countryCode} {phone}
          </p>

          {viaTelegram ? (
            <p className="mt-3 text-sm rounded-xl border border-border bg-secondary/50 px-4 py-3">
              Check Telegram (@{otpMeta?.botUsername || "InfyroMarketBot"}) for your code.
            </p>
          ) : pendingOtp ? (
            <p className="mt-3 text-sm rounded-xl border border-border bg-secondary/50 px-4 py-3 mono">
              Your code:{" "}
              <span className="text-primary font-medium tracking-widest">{pendingOtp}</span>
              <span className="block text-xs text-muted-foreground mt-1 font-sans tracking-normal">
                Telegram isn’t linked yet, so we showed the code here.
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm rounded-xl border border-border bg-secondary/50 px-4 py-3">
              Enter the 6-digit code from Telegram.
            </p>
          )}

          {otpMeta?.deepLink && !viaTelegram && (
            <a
              href={otpMeta.deepLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm text-primary hover:underline underline-offset-4"
            >
              Open Telegram to link alerts →
            </a>
          )}
        </div>

        <div className="grid grid-cols-6 gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              data-testid={i === 0 ? TID.verifyOtpInput : undefined}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => onDigit(i, e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
              className="h-14 text-center text-xl mono rounded-xl border border-border bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          data-testid={TID.verifyResendBtn}
          disabled={busy || seconds > 0}
          onClick={resend}
          className="text-sm text-muted-foreground disabled:opacity-50 hover:text-foreground text-left"
        >
          {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
        </button>
      </form>
    </StepShell>
  );
}
