"use client";

import { Ban, Check, RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/form-state";
import { changeTaskStatusAction } from "@/lib/tasks/actions";
import type { TaskStatus } from "@/types/database";

function StatusSubmitButton({ status }: { status: TaskStatus }) {
  const { pending } = useFormStatus();
  const config =
    status === "done"
      ? { label: "Complete", icon: Check, variant: "default" as const }
      : status === "cancelled"
        ? { label: "Cancel", icon: Ban, variant: "outline" as const }
        : { label: "Reopen", icon: RotateCcw, variant: "outline" as const };
  const Icon = config.icon;

  return (
    <Button type="submit" variant={config.variant} disabled={pending}>
      <Icon className="size-4" aria-hidden="true" />
      {pending ? "Updating..." : config.label}
    </Button>
  );
}

export function TaskStatusAction({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [state, action] = useActionState(
    changeTaskStatusAction,
    initialFormState,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={status} />
      <StatusSubmitButton status={status} />
      <FormFeedback state={state} />
    </form>
  );
}
