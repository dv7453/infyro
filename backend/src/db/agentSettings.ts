import { supabase } from "../supabase.js";

export type ToolPermission = "auto" | "confirm";

export type ToolPermissions = Record<string, ToolPermission>;

export type DefaultsSettings = {
  timezone: string;
  working_hours: { start: string; end: string };
  default_drive_folder: string;
};

export type AgentSettingsRow = {
  user_id: string;
  persona_prompt: string;
  tool_permissions: ToolPermissions;
  defaults: Partial<DefaultsSettings> | Record<string, unknown>;
};

export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  send_email: "confirm",
  schedule_meeting: "confirm",
  create_document: "auto",
  export_pdf: "auto",
  save_to_drive: "auto",
  create_spreadsheet: "auto",
  search_email: "auto",
};

/** Tools that default to "confirm" — used for hybrid model risk routing. */
export const HIGH_RISK_TOOLS: string[] = Object.entries(
  DEFAULT_TOOL_PERMISSIONS,
)
  .filter(([, permission]) => permission === "confirm")
  .map(([name]) => name);

/** Fixed for all users — not user-editable. */
export const FIXED_DEFAULTS = {
  timezone: "Asia/Kolkata",
  working_hours: { start: "09:30", end: "18:30" },
} as const;

export const EMPTY_DEFAULTS: DefaultsSettings = {
  ...FIXED_DEFAULTS,
  default_drive_folder: "",
};

export function mergeDefaults(
  raw: Partial<DefaultsSettings> | Record<string, unknown> | null | undefined,
): DefaultsSettings {
  return {
    timezone: FIXED_DEFAULTS.timezone,
    working_hours: { ...FIXED_DEFAULTS.working_hours },
    default_drive_folder:
      typeof raw?.default_drive_folder === "string"
        ? raw.default_drive_folder
        : EMPTY_DEFAULTS.default_drive_folder,
  };
}

export async function getAgentSettings(
  userId: string,
): Promise<AgentSettingsRow | null> {
  const { data, error } = await supabase
    .from("agent_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load agent settings: ${error.message}`);
  }

  return data as AgentSettingsRow | null;
}

export async function ensureAgentSettings(
  userId: string,
): Promise<AgentSettingsRow> {
  const existing = await getAgentSettings(userId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("agent_settings")
    .upsert(
      {
        user_id: userId,
        persona_prompt: "",
        tool_permissions: DEFAULT_TOOL_PERMISSIONS,
        defaults: EMPTY_DEFAULTS,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create agent settings: ${error?.message ?? "unknown"}`,
    );
  }

  return data as AgentSettingsRow;
}

export async function updatePersonaPrompt(
  userId: string,
  personaPrompt: string,
): Promise<string> {
  await ensureAgentSettings(userId);
  const { data, error } = await supabase
    .from("agent_settings")
    .update({ persona_prompt: personaPrompt })
    .eq("user_id", userId)
    .select("persona_prompt")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update persona: ${error?.message ?? "unknown"}`,
    );
  }

  return data.persona_prompt as string;
}

export async function updateToolPermissions(
  userId: string,
  toolPermissions: ToolPermissions,
): Promise<ToolPermissions> {
  await ensureAgentSettings(userId);
  const { data, error } = await supabase
    .from("agent_settings")
    .update({ tool_permissions: toolPermissions })
    .eq("user_id", userId)
    .select("tool_permissions")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update tool permissions: ${error?.message ?? "unknown"}`,
    );
  }

  return data.tool_permissions as ToolPermissions;
}

export async function updateDefaults(
  userId: string,
  defaults: DefaultsSettings,
): Promise<DefaultsSettings> {
  await ensureAgentSettings(userId);
  // Timezone and working hours are fixed; only drive folder is persisted from input.
  const toStore: DefaultsSettings = {
    timezone: FIXED_DEFAULTS.timezone,
    working_hours: { ...FIXED_DEFAULTS.working_hours },
    default_drive_folder: defaults.default_drive_folder ?? "",
  };
  const { data, error } = await supabase
    .from("agent_settings")
    .update({ defaults: toStore })
    .eq("user_id", userId)
    .select("defaults")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update defaults: ${error?.message ?? "unknown"}`,
    );
  }

  return mergeDefaults(data.defaults as Partial<DefaultsSettings>);
}
