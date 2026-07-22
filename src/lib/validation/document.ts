import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) =>
    value === "none" || value === "" || value === null ? undefined : value,
  z.uuid().optional(),
);

export const documentUploadFieldsSchema = z.object({
  projectId: optionalUuid,
  taskId: optionalUuid,
});

export const documentIdSchema = z.object({
  documentId: z.uuid("Invalid document identifier."),
});

export const documentSummaryDraftSchema = z.object({
  summary: z.string().trim().min(20).max(6000),
  highlights: z.array(z.string().trim().min(1).max(500)).max(8),
});

export type DocumentSummaryDraft = z.infer<typeof documentSummaryDraftSchema>;
