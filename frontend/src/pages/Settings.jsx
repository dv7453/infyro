import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Trash2, Sun, Moon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { openTelegramUrl, botChatUrl } from "@/lib/telegram";
import { TID } from "@/lib/testIds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Row = ({ label, hint, right, onClick, testId }) => {
  const className = cn(
    "w-full flex items-center gap-4 py-4 px-4 rounded-xl transition-colors",
    onClick ? "hover:bg-secondary/50 cursor-pointer" : "",
  );
  const body = (
    <>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {right}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testId} className={className}>
        {body}
      </button>
    );
  }
  return (
    <div data-testid={testId} className={className}>
      {body}
    </div>
  );
};

export default function Settings() {
  const navigate = useNavigate();
  const profile = useStore((s) => s.profile);
  const phone = useStore((s) => s.phone);
  const code = useStore((s) => s.countryCode);
  const theme = useStore((s) => s.theme);
  const telegramLinked = useStore((s) => s.telegramLinked);
  const botUsername = useStore((s) => s.botUsername);
  const notifications = useStore((s) => s.notifications);
  const agents = useStore((s) => s.agents);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    await actions.signOut();
    navigate("/login");
  };

  const del = async () => {
    await actions.deleteAccount();
    navigate("/login");
  };

  const onTelegram = async () => {
    setBusy(true);
    try {
      if (telegramLinked) {
        openTelegramUrl(botChatUrl(botUsername));
        toast(`Opened @${botUsername}.`);
      } else {
        const res = await actions.linkTelegram();
        if (res.deep_link) {
          openTelegramUrl(res.deep_link);
          toast("Telegram opened — tap Start to finish linking.");
        } else if (res.telegram_linked) {
          openTelegramUrl(botChatUrl(res.bot_username || botUsername));
          toast("Telegram already linked.");
        }
      }
      await actions.refreshData();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Telegram update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Your account, the way things look, and notifications.
        </p>
      </div>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
          Account
        </p>
        <div className="rounded-2xl border border-border divide-y divide-border">
          <Row
            label="Name"
            hint={profile.name || "—"}
            right={<ChevronRight size={16} className="text-muted-foreground" />}
          />
          <Row
            label="Email"
            hint={profile.email || "—"}
            right={<ChevronRight size={16} className="text-muted-foreground" />}
          />
          <Row
            label="Phone"
            hint={`${code} ${phone}`}
            right={<span className="mono text-xs text-muted-foreground">signed in</span>}
          />
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
          How it looks
        </p>
        <div className="rounded-2xl border border-border">
          <Row
            label={theme === "dark" ? "Dark mode" : "Light mode"}
            hint="Switch between light and dark."
            right={
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon size={14} className="text-muted-foreground" />
                ) : (
                  <Sun size={14} className="text-muted-foreground" />
                )}
                <Switch
                  data-testid={TID.settingsThemeToggle}
                  checked={theme === "dark"}
                  onCheckedChange={(v) => actions.setTheme(v ? "dark" : "light")}
                />
              </div>
            }
          />
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
          Notifications
        </p>
        <div className="rounded-2xl border border-border divide-y divide-border">
          <Row
            label="Alerts"
            hint="Watcher alerts from the API."
            right={
              <Switch
                checked={notifications.alertsEnabled !== false}
                onCheckedChange={async (v) => {
                  try {
                    await actions.setAlertsEnabled(v);
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Couldn’t update.");
                  }
                }}
              />
            }
          />
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
          Telegram
        </p>
        <div className="rounded-2xl border border-border p-4 flex items-start gap-3">
          <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Send size={14} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {telegramLinked ? "Telegram is linked." : "Link Telegram for chat & alerts."}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opens @{botUsername || "InfyroMarketBot"}. Tap Start once to connect this account.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant={telegramLinked ? "secondary" : "default"}
              onClick={onTelegram}
              disabled={busy}
              data-testid={TID.settingsTelegramLink}
              className="rounded-full h-9 text-sm"
            >
              {telegramLinked ? "Open chat" : "Link"}
            </Button>
            {telegramLinked && (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await actions.unlinkTelegram();
                    toast("Telegram unlinked.");
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Unlink failed.");
                  }
                }}
                className="rounded-full h-8 text-xs text-muted-foreground"
              >
                Unlink
              </Button>
            )}
          </div>
        </div>
      </section>

      {agents.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-4">
            API keys per watcher
          </p>
          <div className="rounded-2xl border border-border divide-y divide-border">
            {agents.map((a) => (
              <Row
                key={a.id}
                label={a.name}
                hint={a.hasApiKey ? "Key saved" : "No key yet"}
                onClick={() => navigate(`/agents/${a.id}`)}
                right={<ChevronRight size={16} className="text-muted-foreground" />}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <Button
          variant="secondary"
          onClick={signOut}
          data-testid={TID.settingsSignOut}
          className="rounded-full h-12 justify-start px-4"
        >
          <LogOut size={16} className="mr-2" />
          Sign out
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              data-testid={TID.settingsDeleteAccount}
              className="rounded-full h-12 justify-start px-4 text-destructive hover:text-destructive"
            >
              <Trash2 size={16} className="mr-2" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                All your watchers, alerts and preferences will be erased. This can&apos;t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep account</AlertDialogCancel>
              <AlertDialogAction
                onClick={del}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <p className="text-center text-xs text-muted-foreground pb-4">
        infyro — every market, one thread.
      </p>
    </div>
  );
}
