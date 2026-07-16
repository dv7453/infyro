import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SKIP_AUTH } from "@/lib/flags";
import { useStore } from "@/lib/store";

// Blocks the app until auth + profile are complete (unless MVP skip-auth is on).
export default function AuthGate() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const profile = useStore((s) => s.profile);
  const location = useLocation();

  if (SKIP_AUTH) return <Outlet />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!profile.complete) {
    if (!profile.name) return <Navigate to="/welcome/name" replace />;
    if (!profile.email) return <Navigate to="/welcome/email" replace />;
    return <Navigate to="/welcome/age" replace />;
  }
  return <Outlet />;
}
