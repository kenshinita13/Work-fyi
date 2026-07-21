"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/form-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveAiTaskPlanSchema } from "@/lib/validation/ai-task-plan";

export async function approveAiTaskPlanAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = approveAiTaskPlanSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { status: "error", message: "This AI plan draft is invalid." };
  }

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return { status: "error", message: "Sign in again to approve this plan." };
  }
  if (!canManageProjects(context.membership.role)) {
    return {
      status: "error",
      message: "Your workspace role has read-only task access.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: createdCount, error } = await supabase.rpc(
    "approve_ai_task_plan",
    { input_draft_id: parsed.data.draftId },
  );

  if (error || !createdCount || createdCount < 0) {
    const message =
      createdCount === -1 || error?.message.includes("expired")
        ? "This AI plan draft expired. Generate a fresh plan."
        : "We could not approve this AI plan.";
    return { status: "error", message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/ai");
  redirect("/tasks");
}
