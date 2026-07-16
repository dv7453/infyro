import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepShell from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { AGENT_COLORS, PERSONA_PRESETS } from "@/lib/constants";
import { TID } from "@/lib/testIds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TOTAL = 4;

export default function AgentNew() {
  const navigate = useNavigate();
  const catalog = useStore((s) => s.catalog);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0].value);
  const [market, setMarket] = useState("crypto");
  const [watching, setWatching] = useState([]);
  const [persona, setPersona] = useState("straight");
  const [personaText, setPersonaText] = useState(PERSONA_PRESETS[0].text);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("groq");

  useEffect(() => {
    if (!catalog.length) {
      actions.refreshData().catch(() => {});
    }
  }, [catalog.length]);

  const availableSources = useMemo(
    () =>
      catalog.filter(
        (s) =>
          market === "both" ||
          s.market === market ||
          (market !== "news" && s.market === "news"),
      ),
    [catalog, market],
  );

  const back = () => (step > 1 ? setStep(step - 1) : navigate(-1));

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && watching.length > 0) ||
    (step === 3 && personaText.trim().length > 0) ||
    step === 4;

  const toggleSource = (id) => {
    setWatching((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  };

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      const agent = await actions.addAgent({
        name: name.trim(),
        color,
        sourceIds: watching,
        persona,
        personaText: personaText.trim(),
        apiKey: apiKey.trim(),
        llmProvider: provider,
      });
      toast(`${agent.name} is now listening.`);
      navigate(`/agents/${agent.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t create watcher.");
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    if (step < TOTAL) setStep(step + 1);
    else finish();
  };

  return (
    <StepShell
      step={step}
      total={TOTAL}
      onBack={back}
      bottom={
        <div className="flex flex-col gap-2">
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={back}
              data-testid={TID.wizBackBtn}
              className="h-14 rounded-full px-6 text-base"
            >
              Back
            </Button>
            <Button
              onClick={onNext}
              disabled={!canNext || busy}
              data-testid={step === TOTAL ? TID.wizFinishBtn : TID.wizNextBtn}
              className="flex-1 h-14 rounded-full text-base font-medium"
            >
              {busy ? "Creating…" : step === TOTAL ? "Create watcher" : "Continue"}
            </Button>
          </div>
        </div>
      }
    >
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Give it a name.</h1>
            <p className="mt-3 text-muted-foreground">
              Something short — like &quot;Morning market&quot; or &quot;Crypto&quot;.
            </p>
          </div>
          <input
            data-testid={TID.wizNameInput}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning market"
            className="w-full h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          />
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Pick a color</p>
            <div className="flex gap-3 flex-wrap">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  data-testid={TID.wizColorOption}
                  aria-label={c.name}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-105",
                    color === c.value
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      : "",
                  )}
                  style={{ background: c.value }}
                >
                  {color === c.value && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl tracking-tight">What should it watch?</h1>
            <p className="mt-3 text-muted-foreground">
              These come from your live MCP catalog (CoinGecko, Yahoo, and more).
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { key: "crypto", label: "Crypto" },
              { key: "stocks", label: "Stocks" },
              { key: "both", label: "Both" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMarket(m.key);
                  setWatching([]);
                }}
                data-testid={TID.wizMarketChip}
                className={cn(
                  "px-4 h-10 rounded-full text-sm font-medium border transition-colors duration-150",
                  market === m.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground border-border hover:bg-secondary",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {availableSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No catalog sources yet. Make sure the API is running and seeded.
              </p>
            ) : (
              availableSources.map((s) => {
                const selected = watching.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSource(s.id)}
                    className={cn(
                      "text-left rounded-2xl border p-4 transition-colors duration-150",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{s.blurb}</p>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0",
                          selected ? "bg-primary border-primary" : "border-border",
                        )}
                      >
                        {selected && (
                          <Check size={12} className="text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl tracking-tight">How should it talk?</h1>
            <p className="mt-3 text-muted-foreground">
              Pick a style. You can tweak the words below.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PERSONA_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPersona(p.key);
                  setPersonaText(p.text);
                }}
                data-testid={TID.wizPersonaCard}
                className={cn(
                  "text-left rounded-2xl border p-3 transition-colors duration-150",
                  persona === p.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary/40",
                )}
              >
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.blurb}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              What it should say (in your words)
            </label>
            <Textarea
              data-testid={TID.wizPersonaText}
              value={personaText}
              onChange={(e) => setPersonaText(e.target.value)}
              rows={4}
              className="mt-2 rounded-xl bg-secondary/50 border-border text-base"
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Your AI key</h1>
            <p className="mt-3 text-muted-foreground">
              Paste your Groq, OpenAI, or Claude key. We store it locked and never show it again.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { k: "groq", l: "Groq" },
              { k: "openai", l: "OpenAI" },
              { k: "claude", l: "Claude" },
            ].map((p) => (
              <button
                key={p.k}
                type="button"
                onClick={() => setProvider(p.k)}
                className={cn(
                  "px-4 h-9 rounded-full text-sm border",
                  provider === p.k
                    ? "bg-foreground text-background border-foreground"
                    : "border-border",
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
          <input
            data-testid={TID.wizApiKey}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full h-14 bg-secondary/50 border border-border rounded-xl px-4 text-lg mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
          />
          <p className="text-xs text-muted-foreground">
            Skip for now if you want — you can add it later from the watcher&apos;s page.
          </p>
        </div>
      )}
    </StepShell>
  );
}
