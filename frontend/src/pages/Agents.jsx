import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, useStore } from "@/lib/store";
import AgentCard from "@/components/AgentCard";
import { TID } from "@/lib/testIds";

export default function Agents() {
    const agents = useStore((s) => s.agents);
    const alerts = useStore((s) => s.alerts);
    const alertByAgent = (id) => alerts.find((a) => a.agentId === id);

    useEffect(() => {
        actions.refreshData().catch(() => {});
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
                        Watchers
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Small helpers that keep an eye on things for you.
                    </p>
                    <Link
                        to="/sources"
                        className="mt-2 inline-block text-sm text-primary hover:underline underline-offset-4"
                    >
                        Browse sources →
                    </Link>
                </div>
                <Link to="/agents/new">
                    <Button
                        data-testid={TID.agentsCreateBtn}
                        className="rounded-full h-11 px-5"
                    >
                        <Plus size={16} className="mr-1.5" />
                        Create
                    </Button>
                </Link>
            </div>

            {agents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <h3 className="font-display text-xl tracking-tight">
                        No watchers yet.
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Create one to watch the market for you.
                    </p>
                    <Link to="/agents/new">
                        <Button className="mt-5 rounded-full h-12 px-6">
                            <Plus size={16} className="mr-1.5" />
                            Create a watcher
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {agents.map((a) => (
                        <AgentCard
                            key={a.id}
                            agent={a}
                            lastAlert={alertByAgent(a.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
