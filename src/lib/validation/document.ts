import { z } from "zod";

import { MAX_EDITABLE_DOCUMENT_BYTES } from "@/lib/documents/constants";

const optionalUuid = z.preprocess(
  (value) =>
    value === "none" || value === "" || value === null ? undefined : value,
  z.uuid().optional(),
);

export const documentUploadFieldsSchema = z.object({
  projectId: optionalUuid,
  taskId: optionalUuid,
});

const documentFileNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a document name.")
  .max(255, "Document names must be 255 characters or shorter.")
  .refine((value) => !/[\\/]/.test(value), "Enter a valid document name.");

const editableContentSchema = z
  .string()
  .refine(
    (value) =>
      new TextEncoder().encode(value).byteLength <= MAX_EDITABLE_DOCUMENT_BYTES,
    "Editable documents must be 1 MB or smaller.",
  );

export const documentCreateSchema = z.object({
  fileName: documentFileNameSchema,
  format: z.enum(["txt", "md"]),
  content: editableContentSchema,
  projectId: optionalUuid,
  taskId: optionalUuid,
});

export const documentSaveSchema = z.object({
  fileName: documentFileNameSchema,
  content: editableContentSchema,
  expectedRevision: z.number().int().positive(),
});

export const documentSharingSchema = z
  .object({
    visibility: z.enum(["workspace", "restricted"]),
    shares: z
      .array(
        z.object({
          userId: z.uuid(),
          permission: z.enum(["viewer", "editor"]),
        }),
      )
      .max(100),
  })
  .superRefine((value, context) => {
    const userIds = new Set<string>();
    for (const share of value.shares) {
      if (userIds.has(share.userId)) {
        context.addIssue({
          code: "custom",
          message: "Each workmate can only be shared once.",
          path: ["shares"],
        });
        return;
      }
      userIds.add(share.userId);
    }
  });

export const documentIdSchema = z.object({
  documentId: z.uuid("Invalid document identifier."),
});

export const documentSummaryDraftSchema = z.object({
  summary: z.string().trim().min(20).max(6000),
  highlights: z.array(z.string().trim().min(1).max(500)).max(8),
});

export type DocumentSummaryDraft = z.infer<typeof documentSummaryDraftSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentSaveInput = z.infer<typeof documentSaveSchema>;
export type DocumentSharingInput = z.infer<typeof documentSharingSchema>;
