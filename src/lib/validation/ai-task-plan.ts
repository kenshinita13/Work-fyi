import { z } from "zod";

import { containsPotentialSecret } from "@/lib/ai/redact";
import { taskPrioritySchema } from "@/lib/validation/task";

const optionalUuid = z.union([z.uuid(), z.literal(""), z.null()]).default("");

export const aiTaskPlanRequestSchema = z
  .object({
    mode: z.enum(["task_plan", "subtasks"]),
    prompt: z
      .string()
      .trim()
      .min(10, "Describe the outcome in at least 10 characters.")
      .max(4000, "The planning request must be 4,000 characters or fewer.")
      .refine((value) => !containsPotentialSecret(value), {
        message: "Remove passwords, tokens, and API keys before planning.",
      }),
    projectId: optionalUuid,
    parentTaskId: optionalUuid,
  })
  .superRefine((value, context) => {
    if (value.mode === "subtasks" && !value.parentTaskId) {
      context.addIssue({
        code: "custom",
        path: ["parentTaskId"],
        message: "Choose a task before generating subtasks.",
      });
    }

    if (value.mode === "task_plan" && value.parentTaskId) {
      context.addIssue({
        code: "custom",
        path: ["parentTaskId"],
        message: "A full task plan cannot be attached to a parent task.",
      });
    }
  });

const generatedSubtaskSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000),
  priority: taskPrioritySchema,
  dueInDays: z.number().int().min(0).max(365).nullable(),
});

export const generatedTaskSchema = generatedSubtaskSchema.extend({
  subtasks: z.array(generatedSubtaskSchema).max(12),
});

export const generatedTaskPlanSchema = z.object({
  title: z.string().min(2).max(160),
  tasks: z.array(generatedTaskSchema).min(1).max(8),
});

export const approveAiTaskPlanSchema = z.object({
  draftId: z.uuid("Invalid AI plan draft."),
});

export type GeneratedTaskPlan = z.infer<typeof generatedTaskPlanSchema>;
export type AiTaskPlanRequest = z.infer<typeof aiTaskPlanRequestSchema>;
