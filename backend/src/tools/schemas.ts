import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

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

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export const exportPdfSchema = z.object({
  document_id: z.string().min(1),
});

export const saveToDriveSchema = z.object({
  filename: z.string().min(1),
  content_base64: z.string().min(1),
  mime_type: z.string().min(1),
  folder_name: z.string().optional(),
});

export const createSpreadsheetSchema = z.object({
  title: z.string().min(1),
  columns: z.array(z.string()).min(1),
});

export const scheduleMeetingSchema = z.object({
  attendee_email: z.string().email(),
  start_time_iso: z.string().min(1),
  duration_minutes: z.number().positive(),
  title: z.string().optional(),
});

export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const searchEmailSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().positive().optional(),
});

export const toolSchemas: Record<ToolName, z.ZodTypeAny> = {
  create_document: createDocumentSchema,
  export_pdf: exportPdfSchema,
  save_to_drive: saveToDriveSchema,
  create_spreadsheet: createSpreadsheetSchema,
  schedule_meeting: scheduleMeetingSchema,
  send_email: sendEmailSchema,
  search_email: searchEmailSchema,
};

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

export function validateToolArgs(
  toolName: ToolName,
  rawArgs: unknown,
):
  | { ok: true; data: unknown }
  | { ok: false; fields: string[] } {
  const schema = toolSchemas[toolName];
  const result = schema.safeParse(rawArgs);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const fields = result.error.issues.map((issue) =>
    issue.path.length > 0 ? issue.path.join(".") : issue.message,
  );
  return { ok: false, fields: [...new Set(fields)] };
}

export const openAiTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_document",
      description: "Create a Google Doc with the given title and body content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Document title" },
          content: { type: "string", description: "Document body text" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_pdf",
      description:
        "Export a Google Doc as a PDF. Returns base64 content that can be passed to save_to_drive.",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "string",
            description: "Google Docs document ID",
          },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_to_drive",
      description:
        "Upload a file to Google Drive. Optionally place it in a folder by name (creates the folder if missing).",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" },
          content_base64: {
            type: "string",
            description: "File contents encoded as base64",
          },
          mime_type: { type: "string" },
          folder_name: {
            type: "string",
            description: "Optional Drive folder name",
          },
        },
        required: ["filename", "content_base64", "mime_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_spreadsheet",
      description:
        "Create a Google Spreadsheet with the given title and header columns.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Header row column names",
          },
        },
        required: ["title", "columns"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_meeting",
      description:
        "Create a Google Calendar event with a Google Meet link and email the invite to the attendee.",
      parameters: {
        type: "object",
        properties: {
          attendee_email: { type: "string" },
          start_time_iso: {
            type: "string",
            description: "ISO 8601 start time",
          },
          duration_minutes: { type: "number" },
          title: { type: "string" },
        },
        required: ["attendee_email", "start_time_iso", "duration_minutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via Gmail on behalf of the user.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_email",
      description: "Search the user's Gmail inbox with a Gmail query string.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Gmail search query (e.g. from:alice subject:invoice)",
          },
          max_results: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
];
