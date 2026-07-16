import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, useStore } from "@/lib/store";
import { openTelegramUrl, botChatUrl } from "@/lib/telegram";
import AgentCard from "@/components/AgentCard";
import { TID } from "@/lib/testIds";
import { toast } from "sonner";

export default function Home() {
    const profile = useStore((s) => s.profile);
    const agents = useStore((s) => s.agents);
    const alerts = useStore((s) => s.alerts);
    const telegramLinked = useStore((s) => s.telegramLinked);
    const botUsername = useStore((s) => s.botUsername);

    useEffect(() => {
        actions.refreshData().catch(() => {});
    }, []);

    const hour = new Date().getHours();
    const greet =
        hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const alertByAgent = (id) => alerts.find((a) => a.agentId === id);

    return (
        <div className="flex flex-col gap-8">
            <section>
                <p className="text-sm text-muted-foreground">{greet},</p>
                <h1
                    className="font-display text-3xl sm:text-4xl tracking-tight"
                    data-testid={TID.homeGreeting}
                >
                    {profile.name || "there"}.
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Here's what your watchers are seeing.
                </p>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground/90 border-l-2 border-border pl-3">
                    Beta note: Telegram linking can be inconsistent in this build.
                    Phone-number verification isn’t available on the free-tier messaging
                    provider, so auth for the demo is a temporary workaround — not the
                    production path.
                </p>
            </section>

            <section className="flex flex-col gap-3">
                {agents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                        <h3 className="font-display text-xl tracking-tight">
                            No watchers yet.
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Create one to keep an eye on the markets for you.
                        </p>
                        <div className="mt-5 flex justify-center">
                            <Link to="/agents/new">
                                <Button
                                    data-testid={TID.homeCreateAgent}
                                    className="h-12 rounded-full px-6"
                                >
                                    <Plus size={16} className="mr-1.5" />
                                    Create your first watcher
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <h2 className="font-display text-lg tracking-tight text-foreground">
                                Your watchers
                            </h2>
                            <Link to="/agents/new">
                                <button
                                    data-testid={TID.homeCreateAgent}
                                    className="text-sm text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    New
                                </button>
                            </Link>
                        </div>
                        {agents.map((a) => (
                            <AgentCard
                                key={a.id}
                                agent={a}
                                lastAlert={alertByAgent(a.id)}
                            />
                        ))}
                    </>
                )}
            </section>

            {agents.length > 0 && (
                <section className="rounded-2xl bg-secondary/50 p-5 flex items-start gap-4">
                    <div className="mt-1 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Send size={16} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-medium text-foreground">
                            Chat on Telegram
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Get alerts and ask your watchers questions right from Telegram.
                        </p>
                        <button
                            type="button"
                            className="mt-3 text-sm text-primary hover:underline underline-offset-4"
                            onClick={async () => {
                                try {
                                    if (telegramLinked) {
                                        openTelegramUrl(botChatUrl(botUsername));
                                    } else {
                                        const res = await actions.linkTelegram();
                                        openTelegramUrl(
                                            res.deep_link || botChatUrl(res.bot_username || botUsername),
                                        );
                                        toast("Tap Start in Telegram to finish linking.");
                                    }
                                } catch {
                                    openTelegramUrl(botChatUrl(botUsername));
                                }
                            }}
                        >
                            {telegramLinked ? "Open Telegram →" : "Link Telegram →"}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
