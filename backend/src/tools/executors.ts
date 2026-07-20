import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import {
  getCalendar,
  getDocs,
  getDrive,
  getGmail,
  getSheets,
} from "../google/client.js";
import {
  createDocumentSchema,
  createSpreadsheetSchema,
  exportPdfSchema,
  saveToDriveSchema,
  scheduleMeetingSchema,
  searchEmailSchema,
  sendEmailSchema,
  type ToolName,
} from "./schemas.js";
import type { z } from "zod";

type CreateDocumentArgs = z.infer<typeof createDocumentSchema>;
type ExportPdfArgs = z.infer<typeof exportPdfSchema>;
type SaveToDriveArgs = z.infer<typeof saveToDriveSchema>;
type CreateSpreadsheetArgs = z.infer<typeof createSpreadsheetSchema>;
type ScheduleMeetingArgs = z.infer<typeof scheduleMeetingSchema>;
type SendEmailArgs = z.infer<typeof sendEmailSchema>;
type SearchEmailArgs = z.infer<typeof searchEmailSchema>;

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function findOrCreateFolder(
  userId: string,
  folderName: string,
): Promise<string> {
  const drive = await getDrive(userId);
  const list = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1,
  });

  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error("Failed to create Drive folder");
  }
  return created.data.id;
}

async function executeCreateDocument(
  userId: string,
  args: CreateDocumentArgs,
) {
  const docs = await getDocs(userId);
  const created = await docs.documents.create({
    requestBody: { title: args.title },
  });
  const documentId = created.data.documentId;
  if (!documentId) {
    throw new Error("Docs API did not return a document ID");
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: args.content,
          },
        },
      ],
    },
  });

  return { documentId, title: args.title };
}

async function executeExportPdf(userId: string, args: ExportPdfArgs) {
  const drive = await getDrive(userId);
  const response = await drive.files.export(
    {
      fileId: args.document_id,
      mimeType: "application/pdf",
    },
    { responseType: "arraybuffer" },
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);
  return {
    document_id: args.document_id,
    content_base64: buffer.toString("base64"),
    mime_type: "application/pdf",
    byteLength: buffer.length,
  };
}

async function executeSaveToDrive(userId: string, args: SaveToDriveArgs) {
  const drive = await getDrive(userId);
  const parents: string[] = [];
  if (args.folder_name) {
    const folderId = await findOrCreateFolder(userId, args.folder_name);
    parents.push(folderId);
  }

  const mediaBody = Readable.from(Buffer.from(args.content_base64, "base64"));

  const created = await drive.files.create({
    requestBody: {
      name: args.filename,
      parents: parents.length > 0 ? parents : undefined,
    },
    media: {
      mimeType: args.mime_type,
      body: mediaBody,
    },
    fields: "id, name, webViewLink",
  });

  return {
    fileId: created.data.id,
    filename: args.filename,
    webViewLink: created.data.webViewLink,
  };
}

async function executeCreateSpreadsheet(
  userId: string,
  args: CreateSpreadsheetArgs,
) {
  const sheets = await getSheets(userId);
  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title: args.title } },
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Sheets API did not return a spreadsheet ID");
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [args.columns],
    },
  });

  return { spreadsheetId, title: args.title, columns: args.columns };
}

async function executeScheduleMeeting(
  userId: string,
  args: ScheduleMeetingArgs,
) {
  const calendar = await getCalendar(userId);
  const start = new Date(args.start_time_iso);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start_time_iso");
  }
  const end = new Date(start.getTime() + args.duration_minutes * 60_000);
  const title = args.title ?? "Meeting";

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: title,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: [{ email: args.attendee_email }],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  return {
    eventId: event.data.id,
    title,
    hangoutLink: event.data.hangoutLink,
    htmlLink: event.data.htmlLink,
    attendee_email: args.attendee_email,
  };
}

async function executeSendEmail(userId: string, args: SendEmailArgs) {
  const gmail = await getGmail(userId);
  const rawMessage = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    args.body,
  ].join("\r\n");

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: toBase64Url(rawMessage),
    },
  });

  return {
    messageId: sent.data.id,
    to: args.to,
    subject: args.subject,
  };
}

async function executeSearchEmail(userId: string, args: SearchEmailArgs) {
  const gmail = await getGmail(userId);
  const maxResults = args.max_results ?? 10;
  const list = await gmail.users.messages.list({
    userId: "me",
    q: args.query,
    maxResults,
  });

  const ids = list.data.messages ?? [];
  const messages = [];

  for (const item of ids) {
    if (!item.id) continue;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: item.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const headers = full.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? "";

    messages.push({
      id: item.id,
      snippet: full.data.snippet ?? "",
      from: getHeader("From"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
    });
  }

  return { query: args.query, count: messages.length, messages };
}

export async function executeTool(
  userId: string,
  toolName: ToolName,
  args: unknown,
): Promise<unknown> {
  switch (toolName) {
    case "create_document":
      return executeCreateDocument(userId, args as CreateDocumentArgs);
    case "export_pdf":
      return executeExportPdf(userId, args as ExportPdfArgs);
    case "save_to_drive":
      return executeSaveToDrive(userId, args as SaveToDriveArgs);
    case "create_spreadsheet":
      return executeCreateSpreadsheet(userId, args as CreateSpreadsheetArgs);
    case "schedule_meeting":
      return executeScheduleMeeting(userId, args as ScheduleMeetingArgs);
    case "send_email":
      return executeSendEmail(userId, args as SendEmailArgs);
    case "search_email":
      return executeSearchEmail(userId, args as SearchEmailArgs);
    default: {
      const _exhaustive: never = toolName;
      throw new Error(`Unknown tool: ${_exhaustive}`);
    }
  }
}
