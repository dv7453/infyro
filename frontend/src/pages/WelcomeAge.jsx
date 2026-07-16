import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { TID } from "@/lib/testIds";

export default function WelcomeAge() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const profile = useStore((s) => s.profile);
  const [age, setAge] = useState(profile.age || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profile.name) return <Navigate to="/welcome/name" replace />;
  if (!profile.email) return <Navigate to="/welcome/email" replace />;
  if (profile.complete) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(age);
    if (!Number.isInteger(n) || n < 13 || n > 120) {
      setError("Please enter your age (13 or above).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      actions.setProfileField("age", String(n));
      await actions.completeProfile({ age: String(n) });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell
      step={3}
      total={3}
      bottom={
        <Button
          onClick={submit}
          disabled={busy || !age.trim()}
          data-testid={TID.welcomeAgeContinue}
          className="w-full h-14 rounded-full text-base font-medium"
        >
          {busy ? "Saving…" : "Finish"}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            How old are you?
          </h1>
          <p className="mt-3 text-muted-foreground">
            This helps us show you the right things.
          </p>
        </div>
        <input
          data-testid={TID.welcomeAgeInput}
          autoFocus
          inputMode="numeric"
          value={age}
          onChange={(e) => {
            setAge(e.target.value.replace(/\D/g, "").slice(0, 3));
            setError("");
          }}
          placeholder="e.g. 26"
          className="w-full h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
        />
        {error && (
          <p className="text-sm text-destructive" data-testid="welcome-age-error">
            {error}
          </p>
        )}
      </form>
    </StepShell>
  );
}
