import React, { useEffect, useMemo, useState } from "react";
import { actions, useStore } from "@/lib/store";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Alerts() {
    const alerts = useStore((s) => s.alerts);
    const agents = useStore((s) => s.agents);
    const [filterAgent, setFilterAgent] = useState("all");
    const [filterDir, setFilterDir] = useState("all");

    useEffect(() => {
        actions.refreshData().catch(() => {});
    }, []);

    const filtered = useMemo(() => {
        return alerts.filter(
            (a) =>
                (filterAgent === "all" || a.agentId === filterAgent) &&
                (filterDir === "all" || a.direction === filterDir),
        );
    }, [alerts, filterAgent, filterDir]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
                    Alerts
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Everything your watchers noticed lately.
                </p>
            </div>

            {alerts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterAgent("all")}
                        className={cn(
                            "px-3 h-8 rounded-full text-xs font-medium border transition-colors",
                            filterAgent === "all"
                                ? "bg-foreground text-background border-foreground"
                                : "border-border text-foreground hover:bg-secondary",
                        )}
                    >
                        All watchers
                    </button>
                    {agents.map((a) => (
                        <button
                            key={a.id}
                            onClick={() => setFilterAgent(a.id)}
                            className={cn(
                                "px-3 h-8 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5",
                                filterAgent === a.id
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border text-foreground hover:bg-secondary",
                            )}
                        >
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: a.color }}
                            />
                            {a.name}
                        </button>
                    ))}
                    <div className="mx-1 self-center h-5 w-px bg-border" />
                    {[
                        { k: "all", l: "Any change" },
                        { k: "up", l: "Up" },
                        { k: "down", l: "Down" },
                    ].map((d) => (
                        <button
                            key={d.k}
                            onClick={() => setFilterDir(d.k)}
                            className={cn(
                                "px-3 h-8 rounded-full text-xs font-medium border transition-colors",
                                filterDir === d.k
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border text-foreground hover:bg-secondary",
                            )}
                        >
                            {d.l}
                        </button>
                    ))}
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <h3 className="font-display text-xl tracking-tight">
                        Nothing to show yet.
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Alerts from your watchers will show up here.
                    </p>
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {filtered.map((a) => (
                        <li
                            key={a.id}
                            className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4"
                        >
                            <span
                                className="h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                                style={{ background: a.agentColor }}
                            >
                                {a.direction === "up" ? (
                                    <ArrowUpRight size={16} />
                                ) : (
                                    <ArrowDownRight size={16} />
                                )}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                        {a.agentName}
                                    </p>
                                    <span
                                        className={cn(
                                            "mono text-sm",
                                            a.direction === "up"
                                                ? "text-success"
                                                : "text-destructive",
                                        )}
                                    >
                                        {a.change > 0 ? "+" : ""}
                                        {a.change}%
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {a.text}
                                </p>
                                <p className="mono text-[11px] text-muted-foreground mt-1">
                                    {new Date(a.at).toLocaleString()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
