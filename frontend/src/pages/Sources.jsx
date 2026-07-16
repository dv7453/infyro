import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Sources() {
  const agents = useStore((s) => s.agents);
  const catalog = useStore((s) => s.catalog);
  const [filter, setFilter] = useState("all");
  const [openFor, setOpenFor] = useState(null);
  const [pickAgent, setPickAgent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    actions.refreshData().catch(() => {});
  }, []);

  const list = catalog.filter((s) => filter === "all" || s.market === filter);

  const addToAgent = async () => {
    if (!openFor || !pickAgent) return;
    const agent = agents.find((a) => a.id === pickAgent);
    if (!agent) return;
    if (agent.sourceIds?.includes(openFor.id)) {
      toast(`${agent.name} is already using ${openFor.name}.`);
      setOpenFor(null);
      return;
    }
    setBusy(true);
    try {
      await actions.addSourceToAgent(agent.id, openFor.id);
      toast(`Added ${openFor.name} to ${agent.name}.`);
      setOpenFor(null);
      setPickAgent("");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn’t add source.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">Sources</h1>
        <p className="mt-2 text-muted-foreground">
          Live MCP catalog your watchers can use.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { k: "all", l: "All" },
          { k: "crypto", l: "Crypto" },
          { k: "stocks", l: "Stocks" },
          { k: "news", l: "News" },
        ].map((c) => (
          <button
            key={c.k}
            onClick={() => setFilter(c.k)}
            className={cn(
              "px-4 h-9 rounded-full text-sm font-medium border transition-colors",
              filter === c.k
                ? "bg-foreground text-background border-foreground"
                : "border-border text-foreground hover:bg-secondary",
            )}
          >
            {c.l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-xl">No sources yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start the API and run the catalog seed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border p-5 flex flex-col"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.market}
              </p>
              <p className="mt-1 font-display text-lg text-foreground">{s.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              <div className="mt-4">
                <Dialog
                  open={openFor?.id === s.id}
                  onOpenChange={(v) => {
                    if (v) setOpenFor(s);
                    else {
                      setOpenFor(null);
                      setPickAgent("");
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="rounded-full h-9 text-sm">
                      Add to a watcher
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add {s.name} to which watcher?</DialogTitle>
                    </DialogHeader>
                    {agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        You don&apos;t have any watchers yet. Create one first.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 mt-2">
                        {agents.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setPickAgent(a.id)}
                            className={cn(
                              "text-left rounded-xl border p-3 transition-colors",
                              pickAgent === a.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-secondary/40",
                            )}
                          >
                            <p className="text-sm font-medium">{a.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Watching {a.watching.length}{" "}
                              {a.watching.length === 1 ? "source" : "sources"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    <DialogFooter>
                      <Button
                        onClick={addToAgent}
                        disabled={!pickAgent || busy}
                        className="rounded-full"
                      >
                        {busy ? "Adding…" : "Add"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
