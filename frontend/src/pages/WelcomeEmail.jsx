import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { actions, useStore } from "@/lib/store";
import { TID } from "@/lib/testIds";

export default function WelcomeEmail() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const profile = useStore((s) => s.profile);
  const [email, setEmail] = useState(profile.email || "");
  const [error, setError] = useState("");

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profile.name) return <Navigate to="/welcome/name" replace />;

  const submit = (e) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v.includes("@") || !v.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    actions.setProfileField("email", v);
    navigate("/welcome/age");
  };

  return (
    <StepShell
      step={2}
      total={3}
      bottom={
        <Button
          onClick={submit}
          disabled={!email.trim()}
          data-testid={TID.welcomeEmailContinue}
          className="w-full h-14 rounded-full text-base font-medium"
        >
          Continue
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            Where can we reach you?
          </h1>
          <p className="mt-3 text-muted-foreground">We'll use this for important updates only.</p>
        </div>
        <input
          data-testid={TID.welcomeEmailInput}
          autoFocus
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="you@email.com"
          className="w-full h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </StepShell>
  );
}
