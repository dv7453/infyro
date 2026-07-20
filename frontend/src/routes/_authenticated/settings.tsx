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
} from "lucide-react";
import {
  disconnect,
  getConnection,
  getDefaults,
  getPersona,
  getToolPermissions,
  updateDefaults,
  updatePersona,
  updateToolPermissions,
  type ConnectionSettings,
  type DefaultsSettings,
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
