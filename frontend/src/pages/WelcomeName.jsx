import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { actions, useStore } from "@/lib/store";
import { TID } from "@/lib/testIds";

export default function WelcomeName() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const profile = useStore((s) => s.profile);
  const [name, setName] = useState(profile.name || "");
  const [error, setError] = useState("");

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tell us what to call you.");
      return;
    }
    actions.setProfileField("name", name.trim());
    navigate("/welcome/email");
  };

  return (
    <StepShell
      step={1}
      total={3}
      bottom={
        <Button
          onClick={submit}
          disabled={!name.trim()}
          data-testid={TID.welcomeNameContinue}
          className="w-full h-14 rounded-full text-base font-medium"
        >
          Continue
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            What should we call you?
          </h1>
          <p className="mt-3 text-muted-foreground">Your first name is perfect.</p>
        </div>
        <input
          data-testid={TID.welcomeNameInput}
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. Priya"
          className="w-full h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </StepShell>
  );
}
