import { z } from "zod";

export const aiTaskPlanSchema = z.object({
  title: z.string().min(2).max(150),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  estimatedEffort: z.string().max(100).optional(),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(2).max(150),
        description: z.string().max(1000).optional(),
      }),
    )
    .max(20),
});

export type AiTaskPlan = z.infer<typeof aiTaskPlanSchema>;
