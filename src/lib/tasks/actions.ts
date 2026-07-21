"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/form-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTaskSchema,
  taskCommentSchema,
  taskMutationSchema,
  updateTaskSchema,
} from "@/lib/validation/task";

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): FormState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Boolean(entry[1]?.length),
    ),
  );

  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

async function getTaskMutationContext() {
  const context = await getWorkspaceContext();

  if (!context) return { error: "Sign in again to continue." } as const;
  if (!context.workspace || !context.membership) {
    return {
      error: "Complete workspace setup before managing tasks.",
    } as const;
  }
  if (!canManageProjects(context.membership.role)) {
    return { error: "Your workspace role has read-only task access." } as const;
  }

  return {
    context: {
      ...context,
      workspace: context.workspace,
      membership: context.membership,
    },
  } as const;
}

async function validateRelationships(
  workspaceId: string,
  values: { projectId: string; assignedTo: string; parentTaskId: string },
) {
  const supabase = await createSupabaseServerClient();
  const [project, assignee, parent] = await Promise.all([
    values.projectId
      ? supabase
          .from("projects")
          .select("id")
          .eq("id", values.projectId)
          .eq("workspace_id", workspaceId)
          .neq("status", "archived")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    values.assignedTo
      ? supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", values.assignedTo)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    values.parentTaskId
      ? supabase
          .from("tasks")
          .select("id")
          .eq("id", values.parentTaskId)
          .eq("workspace_id", workspaceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (values.projectId && !project.data) return "Project not found.";
  if (values.assignedTo && !assignee.data) {
    return "Assignee must be a member of this workspace.";
  }
  if (values.parentTaskId && !parent.data) return "Parent task not found.";
  return null;
}

function taskPayload(values: {
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  projectId: string;
  assignedTo: string;
  parentTaskId: string;
  dueAt: string;
}) {
  return {
    title: values.title,
    description: values.description || null,
    status: values.status,
    priority: values.priority,
    project_id: values.projectId || null,
    assigned_to: values.assignedTo || null,
    parent_task_id: values.parentTaskId || null,
    due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
    completed_at: values.status === "done" ? new Date().toISOString() : null,
  };
}

function revalidateTaskPaths(taskId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getTaskMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const relationshipError = await validateRelationships(
    context.workspace.id,
    parsed.data,
  );
  if (relationshipError) {
    return { status: "error", message: relationshipError };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...taskPayload(parsed.data),
      workspace_id: context.workspace.id,
      created_by: context.claims.sub,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "We could not create the task." };
  }

  revalidateTaskPaths(data.id);
  redirect(`/tasks/${data.id}`);
}

export async function updateTaskAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getTaskMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = updateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  if (parsed.data.taskId === parsed.data.parentTaskId) {
    return { status: "error", message: "A task cannot be its own parent." };
  }

  const relationshipError = await validateRelationships(
    context.workspace.id,
    parsed.data,
  );
  if (relationshipError) {
    return { status: "error", message: relationshipError };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, completed_at")
    .eq("id", parsed.data.taskId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();
  if (!existing) return { status: "error", message: "Task not found." };

  const payload = taskPayload(parsed.data);
  if (parsed.data.status === "done" && existing.completed_at) {
    payload.completed_at = existing.completed_at;
  }

  const { error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", existing.id)
    .eq("workspace_id", context.workspace.id);
  if (error) {
    return { status: "error", message: "We could not update the task." };
  }

  revalidateTaskPaths(existing.id);
  return { status: "success", message: "Task updated." };
}

export async function changeTaskStatusAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getTaskMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = taskMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.taskId)
    .eq("workspace_id", context.workspace.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { status: "error", message: "We could not change task status." };
  }

  revalidateTaskPaths(data.id);
  return { status: "success", message: "Task status updated." };
}

export async function addTaskCommentAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getTaskMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = taskCommentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", parsed.data.taskId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();
  if (!task) return { status: "error", message: "Task not found." };

  const { error } = await supabase.from("task_comments").insert({
    workspace_id: context.workspace.id,
    task_id: task.id,
    author_id: context.claims.sub,
    body: parsed.data.body,
  });
  if (error) {
    return { status: "error", message: "We could not add the comment." };
  }

  revalidateTaskPaths(task.id);
  return { status: "success", message: "Comment added." };
}
