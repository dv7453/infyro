export const OAUTH_SCOPES =
  "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

export const TOOL_NAMES = [
  "send_email",
  "schedule_meeting",
  "create_document",
  "export_pdf",
  "save_to_drive",
  "create_spreadsheet",
  "search_email",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolPermission = "auto" | "confirm";

export const TOOL_LABELS: Record<ToolName, string> = {
  send_email: "Send email",
  schedule_meeting: "Schedule meeting",
  create_document: "Create document",
  export_pdf: "Export PDF",
  save_to_drive: "Save to Drive",
  create_spreadsheet: "Create spreadsheet",
  search_email: "Search email",
};

export const DEFAULT_TOOL_PERMISSIONS: Record<ToolName, ToolPermission> = {
  send_email: "confirm",
  schedule_meeting: "confirm",
  create_document: "auto",
  export_pdf: "auto",
  save_to_drive: "auto",
  create_spreadsheet: "auto",
  search_email: "auto",
};

export function getBackendUrl(): string {
  const url = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (!url) {
    throw new Error("VITE_BACKEND_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

export function getWebSocketUrl(): string {
  const backend = getBackendUrl();
  return `${backend.replace(/^http/, "ws")}/ws`;
}
