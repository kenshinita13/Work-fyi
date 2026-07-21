import { z } from "zod";

export const projectStatusSchema = z.enum([
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const editableProjectStatusSchema = z.enum([
  "active",
  "on_hold",
  "completed",
]);

const projectFields = {
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters.")
    .max(100, "Project name must be 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5,000 characters or fewer."),
  status: editableProjectStatusSchema,
};

export const createProjectSchema = z.object(projectFields);

export const updateProjectSchema = z.object({
  projectId: z.uuid("Invalid project identifier."),
  ...projectFields,
});

export const projectMutationSchema = z.object({
  projectId: z.uuid("Invalid project identifier."),
});

export const projectFiltersSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  status: z
    .enum(["current", "all", "active", "on_hold", "completed", "archived"])
    .optional()
    .default("current"),
});

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
