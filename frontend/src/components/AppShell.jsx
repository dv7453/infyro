import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, MessageSquareText, Bell, Settings as SettingsIcon } from "lucide-react";
import { Wordmark } from "@/components/Logo";
import { TID } from "@/lib/testIds";
import { cn } from "@/lib/utils";

const NAV = [
    { to: "/", label: "Home", icon: Home, testId: TID.navHome, end: true },
    { to: "/agents", label: "Agents", icon: MessageSquareText, testId: TID.navAgents },
    { to: "/alerts", label: "Alerts", icon: Bell, testId: TID.navAlerts },
    { to: "/settings", label: "Settings", icon: SettingsIcon, testId: TID.navSettings },
];

const SideNavItem = ({ to, label, icon: Icon, testId, end }) => (
    <NavLink
        to={to}
        end={end}
        data-testid={testId}
        className={({ isActive }) =>
            cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
            )
        }
    >
        <Icon size={18} strokeWidth={1.8} />
        <span>{label}</span>
    </NavLink>
);

const BottomNavItem = ({ to, label, icon: Icon, testId, end }) => (
    <NavLink
        to={to}
        end={end}
        data-testid={testId}
        className={({ isActive }) =>
            cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150",
                isActive ? "text-primary" : "text-muted-foreground",
            )
        }
    >
        <Icon size={20} strokeWidth={1.8} />
        <span>{label}</span>
    </NavLink>
);

export default function AppShell() {
    const location = useLocation();
    // Hide the shell on auth + onboarding flows
    const hideShell =
        location.pathname.startsWith("/login") ||
        location.pathname.startsWith("/verify") ||
        location.pathname.startsWith("/welcome");

    if (hideShell) return <Outlet />;

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-30 border-b border-border bg-secondary/80 backdrop-blur px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
                beta version 0.0.1
            </div>

            {/* Desktop side nav */}
            <aside className="hidden md:flex fixed top-[29px] bottom-0 left-0 w-64 flex-col border-r border-border bg-background px-4 py-6">
                <div className="px-2 mb-8">
                    <Wordmark />
                </div>
                <nav className="flex flex-col gap-1">
                    {NAV.map((n) => (
                        <SideNavItem key={n.to} {...n} />
                    ))}
                </nav>
                <div className="mt-auto text-xs text-muted-foreground px-2">
                    every market, one thread.
                </div>
            </aside>

            {/* Mobile top bar */}
            <header className="md:hidden sticky top-[29px] z-20 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 h-14">
                <Wordmark />
            </header>

            {/* Main content */}
            <main className="md:pl-64 pb-24 md:pb-8 min-h-screen">
                <div className="mx-auto max-w-3xl px-4 md:px-8 py-6 md:py-10 fade-in">
                    <Outlet />
                </div>
            </main>

            {/* Mobile bottom nav */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur">
                <div className="flex">
                    {NAV.map((n) => (
                        <BottomNavItem key={n.to} {...n} />
                    ))}
                </div>
                <div className="h-[env(safe-area-inset-bottom)]" />
            </nav>
        </div>
    );
}
