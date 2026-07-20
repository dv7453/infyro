import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Settings as SettingsIcon,
  ClipboardList,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ChatSessionProvider } from "@/components/agent/ChatSessionProvider";
import { getSessionUser, signOut, type AuthUser } from "@/lib/auth";
import logo from "@/assets/infyro-logo.png";

function RailButton({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={
        "flex h-11 w-11 items-center justify-center rounded-lg transition-colors " +
        (active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-white/70 hover:text-white hover:bg-white/10")
      }
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const u = await getSessionUser();
      if (cancelled) return;
      if (!u) {
        navigate({ to: "/" });
        return;
      }
      setUser(u);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <ChatSessionProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <aside
          className="flex h-full w-[72px] shrink-0 flex-col items-center justify-between py-4"
          style={{ backgroundColor: "var(--rail)" }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 p-1.5">
              <img
                src={logo}
                alt="Infyro"
                className="h-full w-full object-contain"
              />
            </div>
            <RailButton
              to="/agent"
              label="Agent"
              icon={MessageSquare}
              active={pathname.startsWith("/agent")}
            />
            <RailButton
              to="/form"
              label="Form"
              icon={ClipboardList}
              active={pathname.startsWith("/form")}
            />
            <RailButton
              to="/settings"
              label="Settings"
              icon={SettingsIcon}
              active={pathname.startsWith("/settings")}
            />
          </div>

          <button
            onClick={() => {
              void (async () => {
                await signOut();
                navigate({ to: "/" });
              })();
            }}
            aria-label="Sign out"
            title={user?.email ?? "Sign out"}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </aside>

        <main className="flex h-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </ChatSessionProvider>
  );
}
