export const DOCUMENT_BUCKET = "workspace-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EDITABLE_DOCUMENT_BYTES = 1024 * 1024;
export const MAX_OFFICE_STATE_BYTES = 2 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT_CHARACTERS = 60_000;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
] as const;

export const EDITABLE_DOCUMENT_MIME_TYPES = [
  "text/plain",
  "text/markdown",
] as const;

export const OFFICE_DOCUMENT_MIME_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
