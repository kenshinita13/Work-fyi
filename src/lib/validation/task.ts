import { z } from "zod";

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "none" ? "" : value))
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: "Invalid selection.",
  });

const taskFields = {
  title: z
    .string()
    .trim()
    .min(2, "Task title must be at least 2 characters.")
    .max(200, "Task title must be 200 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(10000, "Description must be 10,000 characters or fewer."),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  projectId: optionalUuid.default(""),
  assignedTo: optionalUuid.default(""),
  parentTaskId: optionalUuid.default(""),
  dueAt: z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid due date.",
    })
    .default(""),
};

export const createTaskSchema = z.object(taskFields);

export const updateTaskSchema = z.object({
  taskId: z.uuid("Invalid task identifier."),
  ...taskFields,
});

export const taskIdSchema = z.object({
  taskId: z.uuid("Invalid task identifier."),
});

export const taskMutationSchema = taskIdSchema.extend({
  status: taskStatusSchema,
});

export const taskCommentSchema = z.object({
  taskId: z.uuid("Invalid task identifier."),
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(5000, "Comment must be 5,000 characters or fewer."),
});

export const taskFiltersSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  status: z
    .enum([
      "current",
      "all",
      "todo",
      "in_progress",
      "review",
      "done",
      "cancelled",
    ])
    .optional()
    .default("current"),
  priority: z
    .enum(["all", "low", "medium", "high", "urgent"])
    .optional()
    .default("all"),
  scope: z
    .enum(["all", "mine", "due_today", "overdue", "completed"])
    .optional()
    .default("all"),
  view: z.enum(["list", "board"]).optional().default("list"),
  projectId: optionalUuid.optional().default(""),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;
