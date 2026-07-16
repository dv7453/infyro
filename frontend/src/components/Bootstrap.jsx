import { useEffect } from "react";
import { actions, useStore } from "@/lib/store";

export default function Bootstrap({ children }) {
  const bootstrapped = useStore((s) => s.bootstrapped);

  useEffect(() => {
    actions.bootstrap();
  }, []);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading Infyro…</p>
      </div>
    );
  }

  return children;
}
