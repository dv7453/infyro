import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Send, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api";
import { actions, useStore } from "@/lib/store";
import { openTelegramUrl } from "@/lib/telegram";
import { TID } from "@/lib/testIds";
import { toast } from "sonner";

export default function AgentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const agents = useStore((s) => s.agents);
    const allAlerts = useStore((s) => s.alerts);
    const agent = useMemo(
        () => agents.find((a) => a.id === id),
        [agents, id],
    );
    const alerts = useMemo(
        () => allAlerts.filter((al) => al.agentId === id),
        [allAlerts, id],
    );

    // All hooks must run unconditionally (before any early return).
    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState("");
    const [personaText, setPersonaText] = useState("");
    const [apiKey, setApiKey] = useState(""); // never pre-fill

    useEffect(() => {
        if (!id) return;
        actions.loadAgentExtras(id).catch(() => {});
    }, [id]);

    useEffect(() => {
        if (!agent) return;
        setName(agent.name || "");
        setPersonaText(agent.personaText || "");
        setEditingName(false);
        setApiKey("");
    }, [agent]);

    if (!agent) return <Navigate to="/agents" replace />;

    const saveName = async () => {
        if (!name.trim()) return;
        try {
            await actions.updateAgent(agent.id, { name: name.trim() });
            setEditingName(false);
        } catch (err) {
            toast(err instanceof ApiError ? err.message : "Couldn’t rename.");
        }
    };

    const savePersona = async () => {
        const key = apiKey.trim();
        try {
            await actions.updateAgent(agent.id, {
                personaText: personaText.trim(),
                llmProvider: agent.llmProvider || "groq",
                ...(key ? { apiKey: key } : {}),
            });
            setApiKey("");
            toast(key ? "Saved — Groq key stored for Telegram chat." : "Saved.");
        } catch (err) {
            toast(err instanceof ApiError ? err.message : "Couldn’t save.");
        }
    };

    const doDelete = async () => {
        try {
            await actions.deleteAgent(agent.id);
            toast("Watcher removed.");
            navigate("/agents");
        } catch (err) {
            toast(err instanceof ApiError ? err.message : "Couldn’t remove.");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <button
                onClick={() => navigate("/agents")}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1 w-fit"
                data-testid="agent-detail-back"
            >
                <ChevronLeft size={16} />
                All watchers
            </button>

            <header className="flex flex-wrap items-start gap-4">
                <span
                    className="mt-2 h-4 w-4 rounded-full flex-shrink-0"
                    style={{ background: agent.color }}
                />
                <div className="flex-1 min-w-0">
                    {editingName ? (
                        <div className="flex gap-2">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                onBlur={saveName}
                                onKeyDown={(e) => e.key === "Enter" && saveName()}
                                className="text-3xl sm:text-4xl font-display tracking-tight bg-transparent border-b border-border focus:border-primary outline-none w-full"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
                                {agent.name}
                            </h1>
                            <button
                                data-testid={TID.agentDetailRename}
                                onClick={() => setEditingName(true)}
                                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                aria-label="Rename"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                                className={
                                    "h-1.5 w-1.5 rounded-full " +
                                    (agent.status === "listening"
                                        ? "bg-success"
                                        : "bg-muted-foreground/50")
                                }
                            />
                            {agent.status === "listening" ? "Listening" : "Paused"}
                        </span>
                        <Switch
                            data-testid={TID.agentDetailToggle}
                            checked={agent.status === "listening"}
                            onCheckedChange={() =>
                                actions.toggleAgentStatus(agent.id)
                            }
                        />
                    </div>
                </div>
                <Button
                    variant="secondary"
                    data-testid={TID.agentDetailTgBtn}
                    onClick={async () => {
                        try {
                            const res = await actions.openAgentTelegram(agent.id);
                            openTelegramUrl(res.url);
                            toast(res.message || "Opening Telegram…");
                        } catch (err) {
                            toast(
                                err instanceof ApiError
                                    ? err.message
                                    : "Couldn’t open Telegram.",
                            );
                        }
                    }}
                    className="rounded-full h-10 shrink-0"
                >
                    <Send size={14} className="mr-1.5" />
                    <span className="hidden sm:inline">Message on Telegram</span>
                    <span className="sm:hidden">Telegram</span>
                </Button>
            </header>

            <Tabs defaultValue="chat">
                <TabsList className="bg-secondary/60 rounded-full h-11 p-1 w-full">
                    <TabsTrigger
                        value="chat"
                        data-testid={TID.agentTabChat}
                        className="rounded-full text-xs sm:text-sm"
                    >
                        Chat
                    </TabsTrigger>
                    <TabsTrigger
                        value="learned"
                        data-testid={TID.agentTabLearned}
                        className="rounded-full text-xs sm:text-sm"
                    >
                        Learned
                    </TabsTrigger>
                    <TabsTrigger
                        value="listening"
                        data-testid={TID.agentTabListening}
                        className="rounded-full text-xs sm:text-sm"
                    >
                        Listening
                    </TabsTrigger>
                    <TabsTrigger
                        value="talks"
                        data-testid={TID.agentTabHowTalks}
                        className="rounded-full text-xs sm:text-sm"
                    >
                        How it talks
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="mt-6">
                    <div className="flex flex-col gap-3">
                        {agent.transcript.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    "max-w-[85%] rounded-2xl px-4 py-3 " +
                                    (m.role === "agent"
                                        ? "bg-secondary/60 text-foreground"
                                        : "bg-primary text-primary-foreground ml-auto")
                                }
                            >
                                <p className="text-sm">{m.text}</p>
                            </div>
                        ))}
                        {alerts.map((al) => (
                            <div
                                key={al.id}
                                className="max-w-[85%] rounded-2xl px-4 py-3 bg-secondary/60"
                            >
                                <p className="text-sm">{al.text}</p>
                                <p className="text-[11px] text-muted-foreground mt-1 mono">
                                    {new Date(al.at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground text-center mt-4">
                            Read-only preview. Chat back on Telegram.
                        </p>
                    </div>
                </TabsContent>

                <TabsContent value="learned" className="mt-6">
                    <div className="rounded-2xl border border-border p-5">
                        <h3 className="font-medium text-foreground">
                            Things it remembers
                        </h3>
                        {agent.memory.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Nothing yet. As you chat, it'll remember useful bits
                                like your preferences.
                            </p>
                        ) : (
                            <ul className="mt-3 flex flex-col gap-2">
                                {agent.memory.map((m, i) => (
                                    <li
                                        key={i}
                                        className="text-sm text-foreground bg-secondary/40 rounded-xl px-3 py-2"
                                    >
                                        {m}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="mt-4">
                            <Button
                                variant="ghost"
                                data-testid={TID.agentForgetBtn}
                                onClick={async () => {
                                    try {
                                        await actions.forgetMemory(agent.id);
                                        toast("Cleared what it learned.");
                                    } catch (err) {
                                        toast(
                                            err instanceof ApiError
                                                ? err.message
                                                : "Couldn’t clear memory.",
                                        );
                                    }
                                }}
                                className="h-9 rounded-full text-sm text-destructive hover:text-destructive"
                            >
                                Forget everything
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="listening" className="mt-6">
                    <div className="rounded-2xl border border-border p-5">
                        <h3 className="font-medium text-foreground">
                            Sources it watches
                        </h3>
                        {(agent.sources || []).length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Not watching anything yet.
                            </p>
                        ) : (
                            <ul className="mt-3 flex flex-col gap-2">
                                {(agent.sources || []).map((src) => (
                                    <li
                                        key={src.id}
                                        className="rounded-xl bg-secondary/40 px-4 py-3"
                                    >
                                        <p className="text-sm font-medium text-foreground">
                                            {src.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {src.category}
                                            {src.tool_names?.length
                                                ? ` · ${src.tool_names.length} tools`
                                                : ""}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="mt-4">
                            <Button
                                variant="ghost"
                                onClick={() => navigate("/sources")}
                                className="h-9 rounded-full text-sm text-primary hover:text-primary"
                            >
                                Browse more sources →
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="talks" className="mt-6">
                    <div className="flex flex-col gap-5">
                        <div>
                            <label className="text-sm font-medium text-foreground">
                                What it should say
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Write like you're telling a friend how to behave.
                            </p>
                            <Textarea
                                value={personaText}
                                onChange={(e) => setPersonaText(e.target.value)}
                                rows={5}
                                className="mt-2 rounded-xl bg-secondary/50 border-border text-base"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground">
                                Groq API key
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Paste your Groq key (starts with gsk_). We store it
                                locked — you can only replace it, not view it. Required
                                for Telegram chat.
                            </p>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={
                                    agent.hasApiKey ? "••••••••••••• (saved — paste to replace)" : "gsk_..."
                                }
                                className="mt-2 w-full h-12 bg-secondary/50 border border-border rounded-xl px-4 text-base mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                            />
                            {agent.hasApiKey && (
                                <p className="mt-1 text-xs text-success">Key is saved on this watcher.</p>
                            )}
                        </div>
                        <Button
                            onClick={savePersona}
                            data-testid={TID.agentSaveHowTalks}
                            className="h-12 rounded-full self-start px-6"
                        >
                            Save
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="pt-4 border-t border-border">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            data-testid={TID.agentDeleteBtn}
                            className="text-destructive hover:text-destructive rounded-full"
                        >
                            <Trash2 size={14} className="mr-1.5" />
                            Remove this watcher
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Remove {agent.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                It'll stop listening and all its alerts will be gone.
                                This can't be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={doDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Yes, remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
