/**
 * Global beta notice — shown on every page during the testing stage.
 */
export function BetaBanner() {
  return (
    <div
      role="status"
      className="shrink-0 border-b border-primary/20 bg-primary-tint/80 px-4 py-2.5 text-center"
    >
      <p className="mx-auto max-w-4xl text-[12px] leading-relaxed text-foreground/90 sm:text-[13px]">
        <span className="font-semibold text-foreground">First beta — testing only.</span>{" "}
        Infyro isn’t ready for public or production use yet. Please avoid sharing
        sensitive or critical data while we test. We’re still early, so we can’t take
        responsibility for data loss or leaks during this stage. Thank you for trying
        Infyro and helping us improve.
      </p>
    </div>
  );
}
