import "server-only";

import mammoth from "mammoth";

import {
  MAX_DOCUMENT_TEXT_CHARACTERS,
  type DocumentMimeType,
} from "@/lib/documents/constants";

function normalizeExtractedText(value: string) {
  return value
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function extractDocumentText(
  data: ArrayBuffer,
  mimeType: DocumentMimeType,
) {
  let extracted: string;

  if (mimeType === "application/pdf") {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(data), {
      mergePages: true,
    });
    if (result.totalPages > 200) {
      throw new Error("document_page_limit");
    }
    extracted = result.text;
  } else if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    if (result.messages.some((message) => message.type === "error")) {
      throw new Error("document_extraction_failed");
    }
    extracted = result.value;
  } else {
    extracted = new TextDecoder("utf-8", { fatal: true }).decode(data);
  }

  const normalized = normalizeExtractedText(extracted);
  if (normalized.length < 20) throw new Error("document_text_too_short");

  return normalized.slice(0, MAX_DOCUMENT_TEXT_CHARACTERS);
}
