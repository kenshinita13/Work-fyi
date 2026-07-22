import "server-only";

import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import { getAiModel } from "@/lib/ai/provider";
import { redactPotentialSecrets } from "@/lib/ai/redact";
import { documentSummaryDraftSchema } from "@/lib/validation/document";

export async function generateDocumentSummary(input: {
  fileName: string;
  mimeType: string;
  text: string;
}) {
  const { model, modelId } = getAiModel();
  const result = await generateText({
    model,
    output: Output.object({
      name: "work_fyi_document_summary",
      description: "A concise document summary draft for user review.",
      schema: documentSummaryDraftSchema,
    }),
    system: [
      "You summarize workplace documents for Work.fyi.",
      "Use only the supplied document text.",
      "Return a neutral draft, not a final approved record.",
      "Capture decisions, obligations, dates, risks, and next steps when present.",
      "Do not invent facts, links, people, or hidden reasoning.",
    ].join(" "),
    prompt: JSON.stringify({
      fileName: input.fileName,
      mimeType: input.mimeType,
      documentText: redactPotentialSecrets(input.text),
    }),
    maxOutputTokens: 1800,
    maxRetries: 1,
    timeout: { totalMs: 30_000, stepMs: 25_000 },
    providerOptions: {
      openai: {
        store: false,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  return {
    summary: documentSummaryDraftSchema.parse(result.output),
    modelId,
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
  };
}
