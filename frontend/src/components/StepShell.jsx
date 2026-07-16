import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Logo";

// Layout for single-question onboarding pages and wizards.
export default function StepShell({
    step,
    total,
    onBack,
    showBack = true,
    children,
    bottom,
}) {
    const navigate = useNavigate();
    const handleBack = () => {
        if (onBack) onBack();
        else navigate(-1);
    };
    return (
        <div className="min-h-screen bg-background flex flex-col fade-in">
            <header className="flex items-center justify-between px-4 h-14 md:h-16">
                {showBack ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Go back"
                        data-testid="step-back-btn"
                    >
                        <ArrowLeft size={20} />
                    </button>
                ) : (
                    <div className="w-8" aria-hidden="true" />
                )}
                <Wordmark />
                <div className="w-8" />
            </header>

            {typeof step === "number" && typeof total === "number" && (
                <div className="px-6 md:px-0 md:mx-auto md:w-full md:max-w-md">
                    <div className="flex items-center gap-1.5 justify-center py-3">
                        {Array.from({ length: total }).map((_, i) => (
                            <span
                                key={i}
                                className={
                                    "h-1.5 rounded-full transition-all duration-150 " +
                                    (i < step
                                        ? "w-6 bg-primary"
                                        : "w-3 bg-border")
                                }
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center pb-2">
                        Step {step} of {total}
                    </p>
                </div>
            )}

            <main className="flex-1 px-6 md:px-0 md:mx-auto md:w-full md:max-w-md py-6">
                {children}
            </main>

            {bottom && (
                <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border md:border-0">
                    <div className="px-6 md:px-0 md:mx-auto md:max-w-md py-4">
                        {bottom}
                    </div>
                    <div className="h-[env(safe-area-inset-bottom)]" />
                </div>
            )}
        </div>
    );
}
