import { Toaster as SonnerToaster } from "sonner";

export function Toaster(props) {
  return (
    <SonnerToaster
      theme="system"
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border border-border shadow-lg",
        },
      }}
      {...props}
    />
  );
}
