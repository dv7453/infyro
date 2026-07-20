import type { DefaultsSettings } from "../db/agentSettings.js";
import { FIXED_DEFAULTS } from "../db/agentSettings.js";

export const STANDING_INSTRUCTION =
  "If you don't have enough information to call a tool with confidence, ask a short specific question instead of calling the tool with guessed or placeholder values. Never invent an email address, time, or filename.";

export function buildSystemPrompt(
  personaPrompt: string,
  _defaults?: DefaultsSettings,
): string {
  const { timezone, working_hours } = FIXED_DEFAULTS;

  const timeContext = [
    `User timezone is fixed to ${timezone} (Indian Standard Time).`,
    `Working hours are fixed to ${working_hours.start}–${working_hours.end} IST.`,
    "When the user gives a date/time without a timezone, interpret it as Asia/Kolkata.",
    "For schedule_meeting, pass start_time_iso with +05:30 offset (e.g. 2026-07-21T15:00:00+05:30). Never default to UTC midnight unless the user asked for UTC.",
  ].join(" ");

  const parts = [personaPrompt.trim(), timeContext, STANDING_INSTRUCTION].filter(
    Boolean,
  );
  return parts.join("\n\n");
}
