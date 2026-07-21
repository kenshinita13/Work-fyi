"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import {
  FieldError,
  FormFeedback,
  SubmitButton,
} from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import {
  createProjectAction,
  updateProjectAction,
} from "@/lib/projects/actions";
import type { Project, ProjectStatus } from "@/types/database";

const editableStatuses: Array<{ value: ProjectStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

export function ProjectFormDialog({
  project,
  defaultOpen = false,
}: {
  project?: Project;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const isEditing = Boolean(project);
  const action = isEditing ? updateProjectAction : createProjectAction;
  const [state, formAction] = useActionState(
    async (previousState: FormState, formData: FormData) => {
      const nextState = await action(previousState, formData);
      if (nextState.status === "success") setOpen(false);
      return nextState;
    },
    initialFormState,
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && defaultOpen && !project) router.replace("/projects");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={isEditing ? "outline" : "default"}>
          {isEditing ? (
            <Pencil className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {isEditing ? "Edit" : "New project"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit project" : "Create project"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the project details visible to your workspace."
              : "Give the work a clear name and starting status."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          {project && (
            <input type="hidden" name="projectId" value={project.id} />
          )}
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              defaultValue={project?.name}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              maxLength={100}
              required
            />
            <FieldError errors={state.fieldErrors?.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              name="description"
              defaultValue={project?.description ?? ""}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              maxLength={5000}
              rows={6}
              placeholder="Purpose, scope, and desired outcome"
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-status">Status</Label>
            <Select
              name="status"
              defaultValue={project?.status ?? "active"}
              required
            >
              <SelectTrigger id="project-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {editableStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={state.fieldErrors?.status} />
          </div>
          <FormFeedback state={state} />
          <div className="flex justify-end">
            <div className="w-full sm:w-36">
              <SubmitButton>
                {isEditing ? "Save changes" : "Create"}
              </SubmitButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
