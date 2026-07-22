import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

import { MAX_OFFICE_STATE_BYTES } from "@/lib/documents/constants";
import type {
  PresentationState,
  RichDocumentState,
  SpreadsheetState,
} from "@/lib/documents/office-types";
import type { DocumentEditorKind } from "@/types/database";

const allowedRichNodes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
]);
const allowedRichMarks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

function isSafeMark(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const mark = value as { type?: unknown; attrs?: unknown };
  if (typeof mark.type !== "string" || !allowedRichMarks.has(mark.type)) {
    return false;
  }
  if (mark.type !== "link") return true;
  if (!mark.attrs || typeof mark.attrs !== "object") return false;
  const href = (mark.attrs as { href?: unknown }).href;
  return (
    typeof href === "string" &&
    (/^https?:\/\//i.test(href) ||
      /^mailto:/i.test(href) ||
      /^tel:/i.test(href) ||
      href.startsWith("/") ||
      href.startsWith("#"))
  );
}

function isRichNode(value: unknown, depth = 0): value is JSONContent {
  if (!value || typeof value !== "object" || depth > 14) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.type !== "string" || !allowedRichNodes.has(node.type)) {
    return false;
  }
  if (node.text !== undefined && typeof node.text !== "string") return false;
  if (
    node.marks !== undefined &&
    (!Array.isArray(node.marks) || node.marks.some((mark) => !isSafeMark(mark)))
  ) {
    return false;
  }
  return (
    node.content === undefined ||
    (Array.isArray(node.content) &&
      node.content.every((child) => isRichNode(child, depth + 1)))
  );
}

const richDocumentStateSchema = z
  .object({
    version: z.literal(1),
    document: z.custom<JSONContent>(
      (value) =>
        isRichNode(value) &&
        value.type === "doc" &&
        JSON.stringify(value).length <= MAX_OFFICE_STATE_BYTES,
      "The document contains unsupported content.",
    ),
  })
  .strict();

const spreadsheetStateSchema = z
  .object({
    version: z.literal(1),
    sheets: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().trim().min(1).max(50),
            cells: z
              .array(z.array(z.string().max(10_000)).max(50))
              .min(1)
              .max(200),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const presentationStateSchema = z
  .object({
    version: z.literal(1),
    slides: z
      .array(
        z
          .object({
            id: z.uuid(),
            title: z.string().max(300),
            body: z.string().max(10_000),
            accent: z.string().regex(/^#[0-9a-f]{6}$/i),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

function isWithinStateLimit(value: unknown) {
  try {
    return (
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      MAX_OFFICE_STATE_BYTES
    );
  } catch {
    return false;
  }
}

export function parseOfficeEditorState(
  kind: Exclude<DocumentEditorKind, "text">,
  value: unknown,
):
  | {
      success: true;
      data: RichDocumentState | SpreadsheetState | PresentationState;
    }
  | { success: false; error: string } {
  if (!isWithinStateLimit(value)) {
    return { success: false, error: "Office files must be 2 MB or smaller." };
  }

  const schema =
    kind === "rich_document"
      ? richDocumentStateSchema
      : kind === "spreadsheet"
        ? spreadsheetStateSchema
        : presentationStateSchema;
  const result = schema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        error:
          result.error.issues[0]?.message ?? "The editor content is invalid.",
      };
}
