import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mail,
  CalendarClock,
  FileText,
  FileDown,
  HardDrive,
  Sheet,
  Search,
  Link2,
  Unlink,
  Check,
  Shield,
  Bot,
  SlidersHorizontal,
  Clock,
  Send,
  Copy,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import {
  disconnect,
  generateTelegramCode,
  getByok,
  getConnection,
  getDefaults,
  getPersona,
  getTelegramStatus,
  getToolPermissions,
  unlinkTelegram,
  updateByok,
  updateDefaults,
  updatePersona,
  updateToolPermissions,
  type ByokProvider,
  type ByokSettings,
  type ConnectionSettings,
  type DefaultsSettings,
  type TelegramLinkCode,
  type TelegramStatus,
  type ToolPermissionsSettings,
} from "@/lib/api";
import { getAccessToken, signInWithGoogle, signOut } from "@/lib/auth";
import {
  DEFAULT_TOOL_PERMISSIONS,
  TOOL_NAMES,
  type ToolName,
  type ToolPermission,
} from "@/lib/constants";
import { getUniqueScopeLabels } from "@/lib/scopes";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Infyro Agent" },
      {
        name: "description",
        content:
          "Manage your Google connection, agent persona, tool permissions, and defaults.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const TOOLS = [
  { id: "send_email" as const, label: "Send email", icon: Mail },
  { id: "schedule_meeting" as const, label: "Schedule meeting", icon: CalendarClock },
  { id: "create_document" as const, label: "Create document", icon: FileText },
  { id: "export_pdf" as const, label: "Export PDF", icon: FileDown },
  { id: "save_to_drive" as const, label: "Save to Drive", icon: HardDrive },
  { id: "create_spreadsheet" as const, label: "Create spreadsheet", icon: Sheet },
  { id: "search_email" as const, label: "Search email", icon: Search },
];

const FIXED_TIMEZONE = "Asia/Kolkata";
const FIXED_WORKING_HOURS = { start: "09:30", end: "18:30" };

type ToolMode = ToolPermission;

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [connection, setConnection] = useState<ConnectionSettings | null>(null);
  const [persona, setPersona] = useState("");
  const [personaSaved, setPersonaSaved] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [personaSaving, setPersonaSaving] = useState(false);

  const [driveFolder, setDriveFolder] = useState("");
  const [driveSaved, setDriveSaved] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSaving, setDriveSaving] = useState(false);

  const [toolModes, setToolModes] = useState<Record<string, ToolMode>>({
    ...DEFAULT_TOOL_PERMISSIONS,
  });
  const [toolsSaved, setToolsSaved] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolsSaving, setToolsSaving] = useState(false);

  const [disconnecting, setDisconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [telegramCode, setTelegramCode] = useState<TelegramLinkCode | null>(
    null,
  );
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramCopied, setTelegramCopied] = useState(false);

  const [byokProvider, setByokProvider] = useState<ByokProvider>("groq");
  const [byokKey, setByokKey] = useState("");
  const [byokStatus, setByokStatus] = useState<ByokSettings | null>(null);
  const [byokSaving, setByokSaving] = useState(false);
  const [byokSaved, setByokSaved] = useState(false);
  const [byokError, setByokError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");

        const [conn, personaData, tools, defaults] = await Promise.all([
          getConnection(token),
          getPersona(token),
          getToolPermissions(token),
          getDefaults(token),
        ]);
        if (cancelled) return;

        setConnection(conn);
        setPersona(personaData.persona_prompt ?? "");
        setToolModes({
          ...DEFAULT_TOOL_PERMISSIONS,
          ...normalizeToolPermissions(tools),
        });
        setDriveFolder(defaults.default_drive_folder ?? "");

        try {
          const tg = await getTelegramStatus(token);
          if (!cancelled) setTelegram(tg);
        } catch (tgErr) {
          if (!cancelled) {
            setTelegramError(
              tgErr instanceof Error
                ? tgErr.message
                : "Failed to load Telegram status",
            );
          }
        }

        try {
          const byok = await getByok(token);
          if (!cancelled) {
            setByokStatus(byok);
            setByokProvider(byok.provider);
          }
        } catch (byokErr) {
          if (!cancelled) {
            setByokError(
              byokErr instanceof Error
                ? byokErr.message
                : "Failed to load BYOK settings",
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load settings",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSavePersona() {
    setPersonaSaving(true);
    setPersonaError(null);
    setPersonaSaved(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      await updatePersona(token, { persona_prompt: persona });
      setPersonaSaved(true);
    } catch (err) {
      setPersonaError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPersonaSaving(false);
    }
  }

  async function handleSaveTools() {
    setToolsSaving(true);
    setToolsError(null);
    setToolsSaved(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      const payload = Object.fromEntries(
        TOOL_NAMES.map((name) => [name, toolModes[name] ?? "confirm"]),
      ) as ToolPermissionsSettings;
      await updateToolPermissions(token, payload);
      setToolsSaved(true);
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setToolsSaving(false);
    }
  }

  async function handleSaveDefaults() {
    setDriveSaving(true);
    setDriveError(null);
    setDriveSaved(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      const payload: DefaultsSettings = {
        timezone: FIXED_TIMEZONE,
        working_hours: FIXED_WORKING_HOURS,
        default_drive_folder: driveFolder,
      };
      await updateDefaults(token, payload);
      setDriveSaved(true);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setDriveSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setConnectionError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      await disconnect(token);
      await signOut();
      navigate({ to: "/" });
    } catch (err) {
      setConnectionError(
        err instanceof Error ? err.message : "Disconnect failed",
      );
      setDisconnecting(false);
    }
  }

  async function handleReconnect() {
    setReconnecting(true);
    setConnectionError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setConnectionError(
        err instanceof Error ? err.message : "Reconnect failed",
      );
      setReconnecting(false);
    }
  }

  async function handleGenerateTelegramCode() {
    setTelegramBusy(true);
    setTelegramError(null);
    setTelegramCopied(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      // Refresh status so the UI picks up a recently-started backend.
      try {
        setTelegram(await getTelegramStatus(token));
      } catch {
        // ignore — generate may still work
      }
      const result = await generateTelegramCode(token);
      setTelegramCode(result);
      if (result.bot_username) {
        setTelegram((prev) =>
          prev
            ? { ...prev, configured: true, bot_username: result.bot_username }
            : {
                linked: false,
                chat_id: null,
                telegram_username: null,
                bot_username: result.bot_username,
                configured: true,
              },
        );
      }
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "Failed to generate code",
      );
    } finally {
      setTelegramBusy(false);
    }
  }

  async function handleUnlinkTelegram() {
    setTelegramBusy(true);
    setTelegramError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      await unlinkTelegram(token);
      setTelegram((prev) =>
        prev
          ? {
              ...prev,
              linked: false,
              chat_id: null,
              telegram_username: null,
            }
          : prev,
      );
      setTelegramCode(null);
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "Failed to unlink Telegram",
      );
    } finally {
      setTelegramBusy(false);
    }
  }

  async function handleCopyCode() {
    if (!telegramCode?.code) return;
    try {
      await navigator.clipboard.writeText(telegramCode.code);
      setTelegramCopied(true);
    } catch {
      setTelegramError("Could not copy code");
    }
  }

  async function handleSaveByok() {
    setByokSaving(true);
    setByokError(null);
    setByokSaved(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      const result = await updateByok(token, {
        provider: byokProvider,
        ...(byokKey.trim() ? { api_key: byokKey.trim() } : {}),
      });
      setByokStatus(result);
      setByokKey("");
      setByokSaved(true);
    } catch (err) {
      setByokError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setByokSaving(false);
    }
  }

  async function handleClearByok() {
    setByokSaving(true);
    setByokError(null);
    setByokSaved(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      const result = await updateByok(token, {
        provider: byokProvider,
        clear: true,
      });
      setByokStatus(result);
      setByokKey("");
      setByokSaved(true);
    } catch (err) {
      setByokError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setByokSaving(false);
    }
  }

  const scopeLabels = connection
    ? getUniqueScopeLabels(connection.scopes)
    : [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage your Google connection, agent persona, and preferences.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          )}
          {loadError && (
            <p className="rounded-lg border border-primary/20 bg-primary-tint/60 p-3 text-sm text-foreground">
              {loadError}
            </p>
          )}

          <Card
            icon={Shield}
            title="Connection"
            description="Your Google account and the permissions Infyro has been granted."
          >
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {connection?.email ?? "—"}
                  </div>
                  <div className="text-xs text-accent">
                    {connection ? "Connected to Google" : "Not connected"}
                  </div>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {(scopeLabels.length
                ? scopeLabels
                : [
                    "Can send email on your behalf",
                    "Can create & update Google Calendar events",
                    "Can create & manage Docs, Sheets, and Drive files",
                    "Read-only access to your inbox for search",
                  ]
              ).map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>

            {connectionError && (
              <p className="mt-3 text-xs text-primary">{connectionError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleReconnect()}
                disabled={reconnecting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                <Link2 className="h-3.5 w-3.5" />
                {reconnecting ? "Redirecting…" : "Reconnect"}
              </button>
              <button
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
              >
                <Unlink className="h-3.5 w-3.5" />
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </Card>

          <Card
            icon={Send}
            title="Telegram"
            description="Link Telegram with a one-time code — no phone number needed."
          >
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {telegram?.linked
                    ? telegram.telegram_username
                      ? `@${telegram.telegram_username}`
                      : "Telegram linked"
                    : "Not linked"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {telegram?.linked
                    ? "Chat with your agent in Telegram"
                    : telegram?.bot_username
                      ? `Bot: @${telegram.bot_username} — generate a code to link`
                      : telegram?.configured
                        ? "Generate a code, then open your bot"
                        : telegram === null
                          ? "Checking Telegram status…"
                          : "Backend has no TELEGRAM_BOT_TOKEN yet"}
                </div>
              </div>
              {telegram?.linked && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">
                  Connected
                </span>
              )}
            </div>

            <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>Click Generate code (expires in 10 minutes).</li>
              <li>
                Open the deep link, or message @{telegram?.bot_username ?? "your bot"} and send the code.
              </li>
              <li>
                Status stays “Not linked” until the bot replies Connected.
              </li>
            </ol>

            {telegramCode && (
              <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
                <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Your code
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl tracking-widest text-foreground">
                    {telegramCode.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                  >
                    <Copy className="h-3 w-3" />
                    {telegramCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                {telegramCode.deep_link && (
                  <a
                    href={telegramCode.deep_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Telegram
                  </a>
                )}
              </div>
            )}

            {telegramError && (
              <p className="mt-3 text-xs text-primary">{telegramError}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {!telegram?.linked && (
                <button
                  onClick={() => void handleGenerateTelegramCode()}
                  disabled={telegramBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {telegramBusy ? "Working…" : "Generate code"}
                </button>
              )}
              {telegram?.linked && (
                <button
                  onClick={() => void handleUnlinkTelegram()}
                  disabled={telegramBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {telegramBusy ? "Unlinking…" : "Unlink"}
                </button>
              )}
            </div>
          </Card>

          <Card
            icon={KeyRound}
            title="BYOK"
            description="Bring your own OpenAI or Groq API key. The agent uses the provider you select."
          >
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {(
                [
                  { id: "groq" as const, label: "Groq" },
                  { id: "openai" as const, label: "OpenAI" },
                ] as const
              ).map((option) => {
                const active = byokProvider === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setByokProvider(option.id);
                      setByokSaved(false);
                    }}
                    className={
                      "rounded-md px-3 py-1.5 font-medium transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                API key
              </label>
              <input
                type="password"
                autoComplete="off"
                value={byokKey}
                onChange={(e) => {
                  setByokKey(e.target.value);
                  setByokSaved(false);
                }}
                placeholder={
                  byokStatus?.has_key
                    ? `Saved key ${byokStatus.key_hint ?? ""} — paste to replace`
                    : byokProvider === "openai"
                      ? "sk-..."
                      : "gsk_..."
                }
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {byokStatus?.has_key
                  ? `Using your ${byokStatus.provider === "openai" ? "OpenAI" : "Groq"} key (${byokStatus.key_hint}). Leave blank to keep it when switching provider.`
                  : "No personal key saved yet — the server Groq key is used as a fallback until you save one."}
              </p>
            </div>

            {byokError && (
              <p className="mt-2 text-xs text-primary">{byokError}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSaveByok()}
                disabled={
                  byokSaving || (!byokKey.trim() && !byokStatus?.has_key)
                }
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {byokSaving ? "Saving…" : "Save"}
              </button>
              {byokStatus?.has_key && (
                <button
                  type="button"
                  onClick={() => void handleClearByok()}
                  disabled={byokSaving}
                  className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  Clear key
                </button>
              )}
              {byokSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Check className="h-3.5 w-3.5" />
                  BYOK saved.
                </span>
              )}
            </div>
          </Card>

          <Card
            icon={Bot}
            title="Persona"
            description="Shape how your agent writes, thinks, and responds."
          >
            <textarea
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setPersonaSaved(false);
              }}
              rows={6}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Describe the tone, style, and behavior of your agent…"
            />
            {personaError && (
              <p className="mt-2 text-xs text-primary">{personaError}</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void handleSavePersona()}
                disabled={personaSaving}
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {personaSaving ? "Saving…" : "Save"}
              </button>
              {personaSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Check className="h-3.5 w-3.5" />
                  Persona saved.
                </span>
              )}
            </div>
          </Card>

          <Card
            icon={SlidersHorizontal}
            title="Tool permissions"
            description="Decide which tools run automatically and which need your confirmation."
          >
            <ul className="divide-y divide-border rounded-xl border border-border bg-background/40">
              {TOOLS.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <t.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm text-foreground">{t.label}</span>
                  </div>
                  <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
                    {(["auto", "confirm"] as ToolMode[]).map((mode) => {
                      const active = toolModes[t.id] === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => {
                            setToolModes((s) => ({ ...s, [t.id]: mode }));
                            setToolsSaved(false);
                          }}
                          className={
                            "rounded-md px-3 py-1.5 font-medium transition-colors " +
                            (active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground")
                          }
                        >
                          {mode === "auto" ? "Auto-run" : "Confirm"}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            {toolsError && (
              <p className="mt-2 text-xs text-primary">{toolsError}</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void handleSaveTools()}
                disabled={toolsSaving}
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {toolsSaving ? "Saving…" : "Save"}
              </button>
              {toolsSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Check className="h-3.5 w-3.5" />
                  Permissions updated.
                </span>
              )}
            </div>
          </Card>

          <Card
            icon={Clock}
            title="Defaults"
            description="Working preferences your agent uses when scheduling and saving."
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Timezone
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  Asia/Kolkata (IST)
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    fixed
                  </span>
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Working hours
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  09:30 – 18:30 IST
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    fixed
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Default Drive folder
              </label>
              <input
                value={driveFolder}
                onChange={(e) => {
                  setDriveFolder(e.target.value);
                  setDriveSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="/Infyro/Agent"
              />
            </div>
            {driveError && (
              <p className="mt-2 text-xs text-primary">{driveError}</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void handleSaveDefaults()}
                disabled={driveSaving}
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {driveSaving ? "Saving…" : "Save"}
              </button>
              {driveSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Check className="h-3.5 w-3.5" />
                  Defaults saved.
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function normalizeToolPermissions(
  tools: ToolPermissionsSettings,
): Record<ToolName, ToolPermission> {
  const next = { ...DEFAULT_TOOL_PERMISSIONS };
  for (const name of TOOL_NAMES) {
    const value = tools[name];
    if (value === "auto" || value === "confirm") {
      next[name] = value;
    }
  }
  return next;
}
