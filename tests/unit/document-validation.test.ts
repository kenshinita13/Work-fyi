import { describe, expect, it } from "vitest";

import { validateDocumentFileMetadata } from "@/lib/documents/files";
import {
  documentCreateSchema,
  documentSaveSchema,
  documentSharingSchema,
  documentSummaryDraftSchema,
  documentUploadFieldsSchema,
} from "@/lib/validation/document";

describe("document validation", () => {
  it("accepts a bounded PDF", () => {
    const result = validateDocumentFileMetadata({
      name: "security-review.pdf",
      size: 512_000,
      type: "application/pdf",
    });

    expect(result).toEqual({
      success: true,
      data: { extension: "pdf", mimeType: "application/pdf" },
    });
  });

  it("accepts Markdown reported as plain text", () => {
    const result = validateDocumentFileMetadata({
      name: "handoff.md",
      size: 2048,
      type: "text/plain",
    });

    expect(result.success).toBe(true);
  });

  it("rejects extension and content-type mismatches", () => {
    const result = validateDocumentFileMetadata({
      name: "renamed.pdf",
      size: 2048,
      type: "text/plain",
    });

    expect(result.success).toBe(false);
  });

  it("rejects oversized documents", () => {
    const result = validateDocumentFileMetadata({
      name: "large.docx",
      size: 10 * 1024 * 1024 + 1,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes unlinked project and task selections", () => {
    const result = documentUploadFieldsSchema.safeParse({
      projectId: "none",
      taskId: "",
    });

    expect(result).toEqual({
      success: true,
      data: { projectId: undefined, taskId: undefined },
    });
  });

  it("accepts an empty native Markdown document", () => {
    const result = documentCreateSchema.safeParse({
      fileName: "handoff",
      format: "md",
      content: "",
      projectId: "none",
      taskId: "none",
    });

    expect(result.success).toBe(true);
  });

  it("rejects editable content larger than one megabyte", () => {
    const result = documentSaveSchema.safeParse({
      fileName: "oversized.md",
      content: "x".repeat(1024 * 1024 + 1),
      expectedRevision: 1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate document share targets", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const result = documentSharingSchema.safeParse({
      visibility: "restricted",
      shares: [
        { userId, permission: "viewer" },
        { userId, permission: "editor" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a bounded summary draft", () => {
    const result = documentSummaryDraftSchema.safeParse({
      summary:
        "The review found two open access-control actions before release.",
      highlights: ["Rotate the staging credential.", "Retest viewer access."],
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized summary output", () => {
    const result = documentSummaryDraftSchema.safeParse({
      summary: "x".repeat(6001),
      highlights: [],
    });

    expect(result.success).toBe(false);
  });
});
