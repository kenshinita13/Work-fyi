"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormState } from "@/lib/auth/form-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canChangeWorkspaceRole } from "@/lib/workspaces/permissions";

const memberRoleSchema = z.object({
  userId: z.uuid("Invalid member identifier."),
  role: z.enum(["admin", "member", "viewer"]),
});

export async function updateMemberRoleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getWorkspaceContext();
  if (!context) return { status: "error", message: "Sign in again." };
  if (!context.workspace || !context.membership) {
    return { status: "error", message: "Workspace not found." };
  }

  const parsed = memberRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Choose a valid workspace role." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!target) return { status: "error", message: "Member not found." };

  if (
    !canChangeWorkspaceRole(
      context.membership.role,
      target.role,
      parsed.data.role,
    )
  ) {
    return {
      status: "error",
      message: "Your role cannot make this membership change.",
    };
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", target.user_id);
  if (error) {
    return { status: "error", message: "We could not update that role." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Workspace role updated." };
}
