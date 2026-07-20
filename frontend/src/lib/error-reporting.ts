/** Lightweight client error logging (no third-party telemetry). */
export function reportClientError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  if (typeof console !== "undefined") {
    console.error("[Infyro]", error, context);
  }
}
