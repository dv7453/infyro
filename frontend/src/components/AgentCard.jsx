import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { TID } from "@/lib/testIds";

const StatusDot = ({ status }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
            className={
                "h-1.5 w-1.5 rounded-full " +
                (status === "listening" ? "bg-success" : "bg-muted-foreground/50")
            }
        />
        {status === "listening" ? "Listening" : "Paused"}
    </span>
);

export default function AgentCard({ agent, lastAlert }) {
    return (
        <Link
            to={`/agents/${agent.id}`}
            data-testid={TID.homeAgentCard}
            className="block rounded-2xl border border-border bg-card hover:bg-secondary/40 transition-colors duration-150 p-5"
        >
            <div className="flex items-start gap-4">
                <span
                    className="mt-1 h-3 w-3 rounded-full flex-shrink-0"
                    style={{ background: agent.color }}
                    aria-hidden
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-lg tracking-tight text-foreground truncate">
                            {agent.name}
                        </h3>
                        <ChevronRight
                            size={18}
                            className="text-muted-foreground flex-shrink-0"
                        />
                    </div>
                    <div className="mt-1">
                        <StatusDot status={agent.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {lastAlert
                            ? lastAlert.text
                            : `Watching ${agent.watching.length} ${
                                  agent.watching.length === 1 ? "source" : "sources"
                              }. No alerts yet.`}
                    </p>
                </div>
            </div>
        </Link>
    );
}
