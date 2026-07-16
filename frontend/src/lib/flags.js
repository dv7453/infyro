/**
 * MVP flags. Auth code stays in the repo — flip these when you want OTP back.
 *
 * Re-enable auth later:
 *   VITE_SKIP_AUTH=0  (frontend/.env or shell)
 *   and keep INFYRO_DEV_MODE=0 on the API for production.
 */
export const SKIP_AUTH =
  String(import.meta.env.VITE_SKIP_AUTH ?? "1").toLowerCase() !== "0" &&
  String(import.meta.env.VITE_SKIP_AUTH ?? "1").toLowerCase() !== "false";
