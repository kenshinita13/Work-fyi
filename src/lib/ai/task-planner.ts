import "server-only";

import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import { getTaskPlanningModel } from "@/lib/ai/provider";
import { redactPotentialSecrets } from "@/lib/ai/redact";
import {
  generatedTaskPlanSchema,
  type AiTaskPlanRequest,
} from "@/lib/validation/ai-task-plan";
import type { PrimaryRole, PrimaryUseCase } from "@/types/database";

type PlanningContext = {
  request: AiTaskPlanRequest;
  professionalRole: PrimaryRole | null;
  primaryUseCase: PrimaryUseCase | null;
  project: { name: string; description: string | null } | null;
  parentTask: {
    title: string;
    description: string | null;
    dueAt: string | null;
  } | null;
};

export async function generateTaskPlan(context: PlanningContext) {
  const { model, modelId } = getTaskPlanningModel();
  const modeInstruction =
    context.request.mode === "subtasks"
      ? "Generate focused child tasks for the supplied parent task."
      : "Generate a concise, executable task plan with optional subtasks.";

  const result = await generateText({
    model,
    output: Output.object({
      name: "work_fyi_task_plan",
      description: "A task plan that a user can review before saving.",
      schema: generatedTaskPlanSchema,
    }),
    system: [
      "You are Work.fyi's task planning assistant.",
      modeInstruction,
      "Use only the supplied context. Never invent people, credentials, links, or private data.",
      "Write task titles as plain text. Keep descriptions practical and concise.",
      "Use null for dueInDays when timing is unclear. Do not include hidden reasoning.",
    ].join(" "),
    prompt: JSON.stringify({
      request: context.request.prompt,
      mode: context.request.mode,
      professionalRole: context.professionalRole,
      primaryUseCase: context.primaryUseCase,
      project: context.project
        ? {
            name: redactPotentialSecrets(context.project.name),
            description: redactPotentialSecrets(context.project.description),
          }
        : null,
      parentTask: context.parentTask
        ? {
            title: redactPotentialSecrets(context.parentTask.title),
            description: redactPotentialSecrets(context.parentTask.description),
            dueAt: context.parentTask.dueAt,
          }
        : null,
    }),
    maxOutputTokens: 2400,
    maxRetries: 1,
    timeout: { totalMs: 30_000, stepMs: 25_000 },
    providerOptions: {
      openai: {
        store: false,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  return {
    plan: generatedTaskPlanSchema.parse(result.output),
    modelId,
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
  };
}
