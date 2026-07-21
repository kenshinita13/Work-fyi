"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/form-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createProjectSchema,
  projectMutationSchema,
  updateProjectSchema,
} from "@/lib/validation/project";

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

async function getProjectMutationContext() {
  const context = await getWorkspaceContext();

  if (!context) {
    return { error: "Sign in again to continue." } as const;
  }

  if (!context.workspace || !context.membership) {
    return {
      error: "Complete workspace setup before managing projects.",
    } as const;
  }

  if (!canManageProjects(context.membership.role)) {
    return {
      error: "Your workspace role has read-only project access.",
    } as const;
  }

  return {
    context: {
      ...context,
      membership: context.membership,
      workspace: context.workspace,
    },
  } as const;
}

export async function createProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getProjectMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = createProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: context.workspace.id,
      created_by: context.claims.sub,
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not create the project. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getProjectMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = updateProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", parsed.data.projectId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!project) {
    return { status: "error", message: "Project not found." };
  }

  if (project.status === "archived") {
    return {
      status: "error",
      message: "Restore this project before editing it.",
    };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status,
    })
    .eq("id", project.id)
    .eq("workspace_id", context.workspace.id);

  if (error) {
    return {
      status: "error",
      message: "We could not update the project. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);

  return { status: "success", message: "Project updated." };
}

export async function archiveProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getProjectMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = projectMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", parsed.data.projectId)
    .eq("workspace_id", context.workspace.id)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not archive that project.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function restoreProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const mutation = await getProjectMutationContext();
  if ("error" in mutation) {
    return { status: "error", message: mutation.error };
  }

  const parsed = projectMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { context } = mutation;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status: "active" })
    .eq("id", parsed.data.projectId)
    .eq("workspace_id", context.workspace.id)
    .eq("status", "archived")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not restore that project.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${data.id}`);
  return { status: "success", message: "Project restored." };
}
