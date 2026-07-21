"use client";

import { Archive } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/auth/form-parts";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/form-state";
import { archiveProjectAction } from "@/lib/projects/actions";

function ArchiveSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Archiving..." : "Archive project"}
    </Button>
  );
}

export function ArchiveProjectDialog({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(
    archiveProjectAction,
    initialFormState,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <Archive className="size-4" aria-hidden="true" />
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this project?</AlertDialogTitle>
          <AlertDialogDescription>
            It will leave the default project list. You can restore it from the
            Archived filter at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="projectId" value={projectId} />
          <FormFeedback state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <ArchiveSubmitButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
