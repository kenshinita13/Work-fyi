"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initialFormState } from "@/lib/auth/form-state";
import { updateMemberRoleAction } from "@/lib/workspaces/actions";
import type { WorkspaceRole } from "@/types/database";

function RoleSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="icon-sm" variant="ghost" disabled={pending}>
      <Save className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Save workspace role</span>
    </Button>
  );
}

export function MemberRoleForm({
  userId,
  role,
  allowedRoles,
}: {
  userId: string;
  role: WorkspaceRole;
  allowedRoles: Array<Exclude<WorkspaceRole, "owner">>;
}) {
  const [state, action] = useActionState(
    updateMemberRoleAction,
    initialFormState,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-1">
        <Select name="role" defaultValue={role}>
          <SelectTrigger size="sm" className="w-28" aria-label="Workspace role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedRoles.map((allowedRole) => (
              <SelectItem key={allowedRole} value={allowedRole}>
                {allowedRole[0].toUpperCase() + allowedRole.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RoleSubmitButton />
      </div>
      <FormFeedback state={state} />
    </form>
  );
}
