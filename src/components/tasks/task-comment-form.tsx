"use client";

import { Send } from "lucide-react";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import { FieldError, FormFeedback } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import { addTaskCommentAction } from "@/lib/tasks/actions";

function CommentSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="size-4" aria-hidden="true" />
      {pending ? "Adding..." : "Add comment"}
    </Button>
  );
}

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(
    async (previousState: FormState, formData: FormData) => {
      const nextState = await addTaskCommentAction(previousState, formData);
      if (nextState.status === "success") formRef.current?.reset();
      return nextState;
    },
    initialFormState,
  );

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea
        name="body"
        rows={3}
        maxLength={5000}
        placeholder="Add context or a progress update"
        aria-label="Comment"
        aria-invalid={Boolean(state.fieldErrors?.body)}
        required
      />
      <FieldError errors={state.fieldErrors?.body} />
      <FormFeedback state={state} />
      <div className="flex justify-end">
        <CommentSubmitButton />
      </div>
    </form>
  );
}
