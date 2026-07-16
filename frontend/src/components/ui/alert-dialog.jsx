import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const Ctx = createContext(null);

export function AlertDialog({ children }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function AlertDialogTrigger({ asChild, children }) {
  const { setOpen } = useContext(Ctx);
  const handleClick = (e) => {
    // Prevent parent row/card handlers from stealing the click.
    e.stopPropagation();
    children?.props?.onClick?.(e);
    if (e.defaultPrevented) return;
    setOpen(true);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
    });
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
      {children}
    </button>
  );
}

export function AlertDialogContent({ className, children }) {
  const { open, setOpen } = useContext(Ctx);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl fade-in",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ className, children }) {
  return <div className={cn("mb-3 space-y-2", className)}>{children}</div>;
}

export function AlertDialogTitle({ className, children }) {
  return <h2 className={cn("font-display text-xl tracking-tight", className)}>{children}</h2>;
}

export function AlertDialogDescription({ className, children }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

export function AlertDialogFooter({ className, children }) {
  return <div className={cn("mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end", className)}>{children}</div>;
}

export function AlertDialogCancel({ className, children, ...props }) {
  const { setOpen } = useContext(Ctx);
  return (
    <button
      type="button"
      className={cn(
        "h-11 rounded-full border border-border px-5 text-sm font-medium hover:bg-secondary transition-colors",
        className,
      )}
      onClick={() => setOpen(false)}
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({ className, children, onClick, ...props }) {
  const { setOpen } = useContext(Ctx);
  return (
    <button
      type="button"
      className={cn(
        "h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
