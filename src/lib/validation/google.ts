import { z } from "zod";

export const googleCapabilityQuerySchema = z.object({
  capability: z.enum(["core", "gmail"]).default("core"),
});

export const googleDriveQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  pageToken: z.string().trim().max(1000).optional(),
});

export const googleGmailQuerySchema = z.object({
  q: z.string().trim().max(200).default("in:inbox"),
  pageToken: z.string().trim().max(1000).optional(),
});

export const googleEmailSummarySchema = z.object({
  messageIds: z.array(z.string().min(1).max(200)).min(1).max(10),
});

export const googleEmailSummaryOutputSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  actionItems: z.array(z.string().trim().min(1).max(300)).max(12),
  importantDates: z.array(z.string().trim().min(1).max(200)).max(10),
});

export const googleGmailDraftSchema = z.object({
  to: z.email().max(320),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  confirmed: z.literal(true),
});

export const googlePublishSchema = z.object({
  documentId: z.uuid(),
  target: z.enum(["docs", "sheets", "slides"]),
  expectedRevision: z.number().int().min(0),
  confirmed: z.literal(true),
});

export const googleDriveImportSchema = z.object({
  fileId: z.string().trim().min(1).max(200),
  confirmed: z.literal(true),
});
