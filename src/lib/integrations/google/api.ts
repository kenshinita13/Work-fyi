import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  PresentationState,
  RichDocumentState,
  SpreadsheetState,
} from "@/lib/documents/office-types";

import { googleFetch } from "./client";

const calendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  htmlLink: z.url().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  organizer: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

const driveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string().optional(),
  size: z.string().optional(),
  webViewLink: z.url().optional(),
  iconLink: z.url().optional(),
  shared: z.boolean().optional(),
});

const gmailMessageListSchema = z.object({
  messages: z
    .array(z.object({ id: z.string(), threadId: z.string() }))
    .default([]),
  nextPageToken: z.string().optional(),
});

const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string().default(""),
  internalDate: z.string().optional(),
  payload: z.object({
    mimeType: z.string().optional(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .default([]),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(z.any()).optional(),
  }),
});

type GmailPayload = z.infer<typeof gmailMessageSchema>["payload"];

function escapeDriveQuery(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function headerValue(
  headers: Array<{ name: string; value: string }>,
  name: string,
) {
  return (
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function gmailBody(payload: GmailPayload): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const parsed = gmailMessageSchema.shape.payload.safeParse(part);
    if (!parsed.success) continue;
    const body = gmailBody(parsed.data);
    if (body) return body;
  }
  return payload.body?.data ? decodeBase64Url(payload.body.data) : "";
}

export async function listGoogleCalendarEvents(accessToken: string) {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.search = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: "20",
    singleEvents: "true",
    orderBy: "startTime",
  }).toString();
  const response = await googleFetch(accessToken, url);
  const payload = z
    .object({ items: z.array(calendarEventSchema).default([]) })
    .parse(await response.json());
  return payload.items;
}

export async function listGoogleDriveFiles(
  accessToken: string,
  input: { q: string; pageToken?: string },
) {
  const filters = ["trashed = false"];
  if (input.q) filters.push(`name contains '${escapeDriveQuery(input.q)}'`);
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  const search = new URLSearchParams({
    q: filters.join(" and "),
    pageSize: "30",
    orderBy: "modifiedTime desc",
    fields:
      "nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,shared)",
  });
  if (input.pageToken) search.set("pageToken", input.pageToken);
  url.search = search.toString();
  const response = await googleFetch(accessToken, url);
  return z
    .object({
      files: z.array(driveFileSchema).default([]),
      nextPageToken: z.string().optional(),
    })
    .parse(await response.json());
}

export async function getGoogleGmailMessage(
  accessToken: string,
  messageId: string,
) {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "full");
  const response = await googleFetch(accessToken, url);
  const message = gmailMessageSchema.parse(await response.json());
  return {
    id: message.id,
    threadId: message.threadId,
    from: headerValue(message.payload.headers, "From"),
    to: headerValue(message.payload.headers, "To"),
    subject: headerValue(message.payload.headers, "Subject") || "(No subject)",
    date: headerValue(message.payload.headers, "Date"),
    snippet: message.snippet,
    body: gmailBody(message.payload).slice(0, 50_000),
  };
}

export async function listGoogleGmailMessages(
  accessToken: string,
  input: { q: string; pageToken?: string },
) {
  const url = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  );
  url.searchParams.set("q", input.q);
  url.searchParams.set("maxResults", "20");
  if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
  const response = await googleFetch(accessToken, url);
  const list = gmailMessageListSchema.parse(await response.json());
  const messages = await Promise.all(
    list.messages.map((message) =>
      getGoogleGmailMessage(accessToken, message.id),
    ),
  );
  return { messages, nextPageToken: list.nextPageToken };
}

function encodeMimeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function createGoogleGmailDraft(
  accessToken: string,
  input: { to: string; subject: string; body: string },
) {
  const mime = [
    `To: ${encodeMimeHeader(input.to)}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    input.body,
  ].join("\r\n");
  const response = await googleFetch(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { raw: Buffer.from(mime).toString("base64url") },
      }),
    },
  );
  return z
    .object({ id: z.string(), message: z.object({ id: z.string() }) })
    .parse(await response.json());
}

export function richDocumentText(state: RichDocumentState) {
  const values: string[] = [];
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const item = node as { type?: string; text?: string; content?: unknown[] };
    if (item.type === "text" && item.text) values.push(item.text);
    for (const child of item.content ?? []) visit(child);
    if (
      ["paragraph", "heading", "blockquote", "listItem"].includes(
        item.type ?? "",
      )
    )
      values.push("\n");
  }
  visit(state.document);
  return values
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function updateGoogleDoc(
  accessToken: string,
  input: { fileId: string; state: RichDocumentState },
) {
  const currentResponse = await googleFetch(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.fileId)}`,
  );
  const current = z
    .object({
      body: z.object({
        content: z
          .array(z.object({ endIndex: z.number().optional() }))
          .default([]),
      }),
    })
    .parse(await currentResponse.json());
  const endIndex = Math.max(
    1,
    ...current.body.content.map((item) => item.endIndex ?? 1),
  );
  const text = richDocumentText(input.state);
  const requests: Array<Record<string, unknown>> = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } },
    });
  }
  if (text) requests.push({ insertText: { location: { index: 1 }, text } });
  if (requests.length > 0) {
    await googleFetch(
      accessToken,
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.fileId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      },
    );
  }
  return {
    id: input.fileId,
    mimeType: "application/vnd.google-apps.document",
    webViewLink: `https://docs.google.com/document/d/${input.fileId}/edit`,
  };
}

export async function createGoogleDoc(
  accessToken: string,
  input: { title: string; state: RichDocumentState },
) {
  const createResponse = await googleFetch(
    accessToken,
    "https://docs.googleapis.com/v1/documents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title.replace(/\.docx$/i, "") }),
    },
  );
  const created = z
    .object({ documentId: z.string(), title: z.string() })
    .parse(await createResponse.json());
  const text = richDocumentText(input.state);
  if (text) {
    await googleFetch(
      accessToken,
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ insertText: { location: { index: 1 }, text } }],
        }),
      },
    );
  }
  return {
    id: created.documentId,
    title: created.title,
    mimeType: "application/vnd.google-apps.document",
    webViewLink: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

export async function createGoogleSheet(
  accessToken: string,
  input: { title: string; state: SpreadsheetState },
) {
  const createResponse = await googleFetch(
    accessToken,
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title: input.title.replace(/\.xlsx$/i, "") },
        sheets: input.state.sheets.map((sheet) => ({
          properties: { title: sheet.name },
        })),
      }),
    },
  );
  const created = z
    .object({
      spreadsheetId: z.string(),
      spreadsheetUrl: z.url(),
      properties: z.object({ title: z.string() }),
    })
    .parse(await createResponse.json());
  const data = input.state.sheets
    .filter((sheet) => sheet.cells.length > 0)
    .map((sheet) => ({
      range: `'${sheet.name.replaceAll("'", "''")}'!A1`,
      values: sheet.cells,
    }));
  if (data.length > 0) {
    await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
      },
    );
  }
  return {
    id: created.spreadsheetId,
    title: created.properties.title,
    mimeType: "application/vnd.google-apps.spreadsheet",
    webViewLink: created.spreadsheetUrl,
  };
}

export async function updateGoogleSheet(
  accessToken: string,
  input: { fileId: string; state: SpreadsheetState },
) {
  const metadataResponse = await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.fileId)}?fields=sheets.properties.title`,
  );
  const metadata = z
    .object({
      sheets: z
        .array(z.object({ properties: z.object({ title: z.string() }) }))
        .default([]),
    })
    .parse(await metadataResponse.json());
  const existing = new Set(
    metadata.sheets.map((sheet) => sheet.properties.title),
  );
  const missing = input.state.sheets.filter(
    (sheet) => !existing.has(sheet.name),
  );
  if (missing.length > 0) {
    await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.fileId)}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: missing.map((sheet) => ({
            addSheet: { properties: { title: sheet.name } },
          })),
        }),
      },
    );
  }
  for (const sheet of input.state.sheets) {
    const range = `'${sheet.name.replaceAll("'", "''")}'`;
    await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.fileId)}/values/${encodeURIComponent(range)}:clear`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
  }
  const data = input.state.sheets.map((sheet) => ({
    range: `'${sheet.name.replaceAll("'", "''")}'!A1`,
    values: sheet.cells,
  }));
  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.fileId)}/values:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    },
  );
  return {
    id: input.fileId,
    mimeType: "application/vnd.google-apps.spreadsheet",
    webViewLink: `https://docs.google.com/spreadsheets/d/${input.fileId}/edit`,
  };
}

function presentationRequests(
  state: PresentationState,
  existingSlideIds: string[] = [],
) {
  const requests: Array<Record<string, unknown>> = [];
  const idPrefix = `wf_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  state.slides.forEach((slide, index) => {
    const pageId = `${idPrefix}_s${index + 1}`;
    const titleId = `${idPrefix}_t${index + 1}`;
    const bodyId = `${idPrefix}_b${index + 1}`;
    requests.push({
      createSlide: {
        objectId: pageId,
        insertionIndex: index,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          {
            layoutPlaceholder: { type: "TITLE", index: 0 },
            objectId: titleId,
          },
          {
            layoutPlaceholder: { type: "BODY", index: 0 },
            objectId: bodyId,
          },
        ],
      },
    });
    if (slide.title) {
      requests.push({
        insertText: {
          objectId: titleId,
          insertionIndex: 0,
          text: slide.title,
        },
      });
    }
    if (slide.body) {
      requests.push({
        insertText: {
          objectId: bodyId,
          insertionIndex: 0,
          text: slide.body,
        },
      });
    }
  });
  requests.push(
    ...existingSlideIds.map((objectId) => ({ deleteObject: { objectId } })),
  );
  return requests;
}

export async function createGoogleSlides(
  accessToken: string,
  input: { title: string; state: PresentationState },
) {
  const createResponse = await googleFetch(
    accessToken,
    "https://slides.googleapis.com/v1/presentations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title.replace(/\.pptx$/i, "") }),
    },
  );
  const created = z
    .object({
      presentationId: z.string(),
      slides: z.array(z.object({ objectId: z.string() })).default([]),
    })
    .parse(await createResponse.json());
  await googleFetch(
    accessToken,
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(created.presentationId)}:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: presentationRequests(
          input.state,
          created.slides.map((slide) => slide.objectId),
        ),
      }),
    },
  );
  return {
    id: created.presentationId,
    mimeType: "application/vnd.google-apps.presentation",
    webViewLink: `https://docs.google.com/presentation/d/${created.presentationId}/edit`,
  };
}

export async function updateGoogleSlides(
  accessToken: string,
  input: { fileId: string; state: PresentationState },
) {
  const response = await googleFetch(
    accessToken,
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(input.fileId)}`,
  );
  const presentation = z
    .object({
      slides: z.array(z.object({ objectId: z.string() })).default([]),
    })
    .parse(await response.json());
  await googleFetch(
    accessToken,
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(input.fileId)}:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: presentationRequests(
          input.state,
          presentation.slides.map((slide) => slide.objectId),
        ),
      }),
    },
  );
  return {
    id: input.fileId,
    mimeType: "application/vnd.google-apps.presentation",
    webViewLink: `https://docs.google.com/presentation/d/${input.fileId}/edit`,
  };
}

export async function getGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string,
) {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
  );
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,webViewLink");
  const response = await googleFetch(accessToken, url);
  return driveFileSchema.parse(await response.json());
}

export async function exportGoogleDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string,
) {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`,
  );
  url.searchParams.set("mimeType", mimeType);
  const response = await googleFetch(accessToken, url, {
    headers: { Accept: mimeType },
  });
  return Buffer.from(await response.arrayBuffer());
}

const slidesReadSchema = z.object({
  slides: z
    .array(
      z.object({
        pageElements: z
          .array(
            z.object({
              shape: z
                .object({
                  placeholder: z
                    .object({ type: z.string().optional() })
                    .optional(),
                  text: z
                    .object({
                      textElements: z
                        .array(
                          z.object({
                            textRun: z
                              .object({ content: z.string() })
                              .optional(),
                          }),
                        )
                        .default([]),
                    })
                    .optional(),
                })
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export async function getGoogleSlidesEditorState(
  accessToken: string,
  fileId: string,
): Promise<PresentationState> {
  const response = await googleFetch(
    accessToken,
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(fileId)}`,
  );
  const presentation = slidesReadSchema.parse(await response.json());
  const slides = presentation.slides.slice(0, 50).map((slide) => {
    const textBlocks = slide.pageElements
      .map((element) => ({
        type: element.shape?.placeholder?.type ?? "",
        text:
          element.shape?.text?.textElements
            .map((item) => item.textRun?.content ?? "")
            .join("")
            .trim() ?? "",
      }))
      .filter((item) => item.text);
    const titleIndex = textBlocks.findIndex((item) =>
      ["TITLE", "CENTERED_TITLE", "SUBTITLE"].includes(item.type),
    );
    const title =
      (titleIndex >= 0 ? textBlocks[titleIndex]?.text : textBlocks[0]?.text) ??
      "Untitled slide";
    return {
      id: randomUUID(),
      title: title.slice(0, 300),
      body: textBlocks
        .filter((_, index) => index !== (titleIndex >= 0 ? titleIndex : 0))
        .map((item) => item.text)
        .join("\n\n")
        .slice(0, 10_000),
      accent: "#2563eb",
    };
  });
  return {
    version: 1,
    slides:
      slides.length > 0
        ? slides
        : [
            {
              id: randomUUID(),
              title: "Untitled slide",
              body: "",
              accent: "#2563eb",
            },
          ],
  };
}
