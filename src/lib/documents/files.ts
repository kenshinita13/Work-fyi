import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentMimeType,
} from "@/lib/documents/constants";

const extensionMimeTypes: Record<string, readonly DocumentMimeType[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
};

type DocumentFileMetadata = {
  name: string;
  size: number;
  type: string;
};

export type ValidatedDocumentFile = {
  extension: keyof typeof extensionMimeTypes;
  mimeType: DocumentMimeType;
};

export function validateDocumentFileMetadata(
  file: DocumentFileMetadata,
):
  | { success: true; data: ValidatedDocumentFile }
  | { success: false; error: string } {
  const fileName = file.name.trim();
  if (!fileName || fileName.length > 255 || /[\\/]/.test(fileName)) {
    return { success: false, error: "Choose a file with a valid name." };
  }

  if (!Number.isSafeInteger(file.size) || file.size < 1) {
    return { success: false, error: "The selected file is empty." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { success: false, error: "Documents must be 10 MB or smaller." };
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !(extension in extensionMimeTypes)) {
    return {
      success: false,
      error: "Upload a PDF, DOCX, TXT, or Markdown file.",
    };
  }

  if (!DOCUMENT_MIME_TYPES.includes(file.type as DocumentMimeType)) {
    return { success: false, error: "This document type is not supported." };
  }

  const allowedForExtension = extensionMimeTypes[extension];
  if (!allowedForExtension.includes(file.type as DocumentMimeType)) {
    return {
      success: false,
      error: "The file extension and content type do not match.",
    };
  }

  return {
    success: true,
    data: {
      extension: extension as keyof typeof extensionMimeTypes,
      mimeType: file.type as DocumentMimeType,
    },
  };
}

export async function validateDocumentSignature(
  file: File,
  extension: ValidatedDocumentFile["extension"],
) {
  const bytes = new Uint8Array(await file.slice(0, 65_536).arrayBuffer());

  if (
    extension === "pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  ) {
    return "The PDF signature is invalid.";
  }

  if (extension === "docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    return "The DOCX container is invalid.";
  }

  if (extension === "txt" || extension === "md") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) return "The text document contains binary data.";
    } catch {
      return "Text documents must use UTF-8 encoding.";
    }
  }

  return null;
}
