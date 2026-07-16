import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const DialogCtx = createContext(null);

export function Dialog({ open: controlledOpen, onOpenChange, children }) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;
  const setOpen = (v) => {
    // Avoid dual-writing when parent owns open state (controlled).
    if (!isControlled) setUncontrolled(v);
    onOpenChange?.(v);
  };
  return (
    <DialogCtx.Provider value={{ open, setOpen }}>{children}</DialogCtx.Provider>
  );
}

export function DialogTrigger({ asChild, children, ...props }) {
  const { setOpen } = useContext(DialogCtx);
  const handleClick = (e) => {
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
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} {...props}>
      {children}
    </button>
  );
}

export function DialogContent({ className, children }) {
  const { open, setOpen } = useContext(DialogCtx);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        className={cn(
          "relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background p-5 shadow-xl fade-in",
          className,
        )}
      >
        <button
          type="button"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, children }) {
  return <div className={cn("mb-3 pr-6", className)}>{children}</div>;
}

export function DialogTitle({ className, children }) {
  return <h2 className={cn("font-display text-xl tracking-tight", className)}>{children}</h2>;
}

export function DialogFooter({ className, children }) {
  return <div className={cn("mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end", className)}>{children}</div>;
}
