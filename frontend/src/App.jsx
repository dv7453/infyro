import React from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import ThemeSync from "@/components/ThemeSync";
import Bootstrap from "@/components/Bootstrap";
import AppShell from "@/components/AppShell";
import AuthGate from "@/components/AuthGate";

import Login from "@/pages/Login";
import Verify from "@/pages/Verify";
import WelcomeName from "@/pages/WelcomeName";
import WelcomeEmail from "@/pages/WelcomeEmail";
import WelcomeAge from "@/pages/WelcomeAge";

import Home from "@/pages/Home";
import Agents from "@/pages/Agents";
import AgentNew from "@/pages/AgentNew";
import AgentDetail from "@/pages/AgentDetail";
import Alerts from "@/pages/Alerts";
import Sources from "@/pages/Sources";
import Settings from "@/pages/Settings";

import { SKIP_AUTH } from "@/lib/flags";

function App() {
  return (
    <div className="min-h-full">
      <ThemeSync />
      <Bootstrap>
        <BrowserRouter>
          <Routes>
            {/* Auth screens kept for later — redirected away while SKIP_AUTH is on */}
            <Route
              path="/login"
              element={SKIP_AUTH ? <Navigate to="/" replace /> : <Login />}
            />
            <Route
              path="/verify"
              element={SKIP_AUTH ? <Navigate to="/" replace /> : <Verify />}
            />
            <Route
              path="/welcome/name"
              element={SKIP_AUTH ? <Navigate to="/" replace /> : <WelcomeName />}
            />
            <Route
              path="/welcome/email"
              element={SKIP_AUTH ? <Navigate to="/" replace /> : <WelcomeEmail />}
            />
            <Route
              path="/welcome/age"
              element={SKIP_AUTH ? <Navigate to="/" replace /> : <WelcomeAge />}
            />

            <Route element={<AuthGate />}>
              <Route path="/agents/new" element={<AgentNew />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/agents/:id" element={<AgentDetail />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/sources" element={<Sources />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to={SKIP_AUTH ? "/" : "/login"} replace />} />
          </Routes>
        </BrowserRouter>
      </Bootstrap>
      <Toaster position="top-center" />
    </div>
  );
}

export default App;
