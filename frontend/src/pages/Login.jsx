import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { TID } from "@/lib/testIds";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const COUNTRIES = [
  { code: "+91", label: "India" },
  { code: "+1", label: "United States (US)" },
  { code: "+44", label: "United Kingdom (UK)" },
  { code: "+971", label: "United Arab Emirates (UAE)" },
  { code: "+65", label: "Singapore" },
  { code: "+61", label: "Australia" },
  { code: "+49", label: "Germany" },
  { code: "+81", label: "Japan" },
  { code: "+86", label: "China" },
  { code: "+55", label: "Brazil" },
];

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const profile = useStore((s) => s.profile);
  const storedCode = useStore((s) => s.countryCode);
  const [countryCode, setCountryCode] = useState(storedCode || "+91");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (isAuthenticated && profile.complete) return <Navigate to="/" replace />;
  if (isAuthenticated && !profile.complete) {
    if (!profile.name) return <Navigate to="/welcome/name" replace />;
    if (!profile.email) return <Navigate to="/welcome/email" replace />;
    return <Navigate to="/welcome/age" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await actions.requestOtp(countryCode, digits);
      navigate("/verify");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send a code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell
      showBack={false}
      bottom={
        <Button
          onClick={submit}
          disabled={busy || phone.replace(/\D/g, "").length < 6}
          data-testid={TID.loginContinueBtn}
          className="w-full h-14 rounded-full text-base font-medium"
        >
          {busy ? "Sending…" : "Continue"}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            Sign in with your phone
          </h1>
          <p className="mt-3 text-muted-foreground">
            We’ll send a code via Telegram (or show it here if Telegram isn’t linked yet).
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              data-testid={TID.loginCountryCode}
              onClick={() => setOpen((v) => !v)}
              className="h-14 w-[92px] px-3 rounded-xl border border-border bg-secondary/50 mono text-base flex items-center justify-between gap-1 hover:bg-secondary transition-colors"
            >
              <span>{countryCode}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
            {open && (
              <ul className="absolute z-20 mt-2 w-64 max-h-64 overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                {COUNTRIES.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-left hover:bg-secondary",
                        c.code === countryCode && "bg-secondary",
                      )}
                      onClick={() => {
                        setCountryCode(c.code);
                        setOpen(false);
                      }}
                    >
                      <span>{c.label}</span>
                      <span className="mono text-xs text-muted-foreground">{c.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            data-testid={TID.loginPhoneInput}
            autoFocus
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            placeholder="98765 43210"
            className="flex-1 h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </StepShell>
  );
}
