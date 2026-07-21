"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/form-state";
import { restoreProjectAction } from "@/lib/projects/actions";

function RestoreSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <RotateCcw className="size-4" aria-hidden="true" />
      {pending ? "Restoring..." : "Restore project"}
    </Button>
  );
}

export function RestoreProjectButton({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(
    restoreProjectAction,
    initialFormState,
  );

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <RestoreSubmitButton />
      <FormFeedback state={state} />
    </form>
  );
}
