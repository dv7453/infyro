import type { ToolName } from "./schemas.js";

export function summarizeToolResult(
  toolName: ToolName,
  success: boolean,
  result: unknown,
): string {
  if (!success) {
    const err =
      result && typeof result === "object" && "error" in result
        ? String((result as { error: unknown }).error)
        : "Tool failed";
    return err;
  }

  switch (toolName) {
    case "create_document": {
      const r = result as { documentId?: string; title?: string };
      return `Created document "${r.title ?? "Untitled"}"${r.documentId ? ` (${r.documentId})` : ""}`;
    }
    case "export_pdf": {
      const r = result as { document_id?: string; byteLength?: number };
      return `Exported PDF for document ${r.document_id ?? ""}${r.byteLength != null ? ` (${r.byteLength} bytes)` : ""}`;
    }
    case "save_to_drive": {
      const r = result as { fileId?: string; filename?: string };
      return `Saved "${r.filename ?? "file"}" to Drive${r.fileId ? ` (${r.fileId})` : ""}`;
    }
    case "create_spreadsheet": {
      const r = result as { spreadsheetId?: string; title?: string };
      return `Created spreadsheet "${r.title ?? "Untitled"}"${r.spreadsheetId ? ` (${r.spreadsheetId})` : ""}`;
    }
    case "schedule_meeting": {
      const r = result as {
        eventId?: string;
        hangoutLink?: string;
        title?: string;
      };
      const meet = r.hangoutLink ? ` Meet: ${r.hangoutLink}` : "";
      return `Scheduled "${r.title ?? "Meeting"}"${meet}`;
    }
    case "send_email": {
      const r = result as { to?: string; subject?: string };
      return `Sent email to ${r.to ?? "recipient"}: ${r.subject ?? ""}`;
    }
    case "search_email": {
      const r = result as { count?: number; query?: string };
      return `Found ${r.count ?? 0} email(s) for query "${r.query ?? ""}"`;
    }
    default:
      return "Done";
  }
}
