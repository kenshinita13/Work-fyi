export const DOCUMENT_BUCKET = "workspace-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EDITABLE_DOCUMENT_BYTES = 1024 * 1024;
export const MAX_DOCUMENT_TEXT_CHARACTERS = 60_000;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

export const EDITABLE_DOCUMENT_MIME_TYPES = [
  "text/plain",
  "text/markdown",
] as const;

export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
