"use client";

import { ListPlus, Pencil, Plus } from "lucide-react";
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
import { createTaskAction, updateTaskAction } from "@/lib/tasks/actions";
import type { Task, TaskPriority, TaskStatus } from "@/types/database";

export type TaskProjectOption = { id: string; name: string };
export type TaskMemberOption = { id: string; name: string };

const statuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TaskFormDialog({
  task,
  projects,
  members,
  parentTask,
  initialProjectId,
  defaultOpen = false,
}: {
  task?: Task;
  projects: TaskProjectOption[];
  members: TaskMemberOption[];
  parentTask?: { id: string; title: string; projectId?: string | null };
  initialProjectId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const isEditing = Boolean(task);
  const isSubtask = Boolean(parentTask);
  const action = isEditing ? updateTaskAction : createTaskAction;
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
    if (!nextOpen && defaultOpen && !task && !parentTask) {
      router.replace("/tasks");
    }
  }

  const triggerLabel = isEditing
    ? "Edit"
    : isSubtask
      ? "Add subtask"
      : "New task";
  const TriggerIcon = isEditing ? Pencil : isSubtask ? ListPlus : Plus;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={isEditing || isSubtask ? "outline" : "default"}>
          <TriggerIcon className="size-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit task"
              : isSubtask
                ? "Create subtask"
                : "Create task"}
          </DialogTitle>
          <DialogDescription>
            {parentTask
              ? `Add focused work under ${parentTask.title}.`
              : "Set ownership, timing, and the next clear outcome."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          {task && <input type="hidden" name="taskId" value={task.id} />}
          <input
            type="hidden"
            name="parentTaskId"
            value={task?.parent_task_id ?? parentTask?.id ?? ""}
          />
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              name="title"
              defaultValue={task?.title}
              maxLength={200}
              aria-invalid={Boolean(state.fieldErrors?.title)}
              required
            />
            <FieldError errors={state.fieldErrors?.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              name="description"
              defaultValue={task?.description ?? ""}
              rows={5}
              maxLength={10000}
              placeholder="Context, acceptance criteria, and useful links"
              aria-invalid={Boolean(state.fieldErrors?.description)}
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-status">Status</Label>
              <Select name="status" defaultValue={task?.status ?? "todo"}>
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select name="priority" defaultValue={task?.priority ?? "medium"}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-project">Project</Label>
              <Select
                name="projectId"
                defaultValue={
                  task?.project_id ??
                  parentTask?.projectId ??
                  initialProjectId ??
                  "none"
                }
              >
                <SelectTrigger id="task-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={state.fieldErrors?.projectId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                name="assignedTo"
                defaultValue={task?.assigned_to ?? "none"}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={state.fieldErrors?.assignedTo} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-due-at">Due date</Label>
            <Input
              id="task-due-at"
              name="dueAt"
              type="datetime-local"
              defaultValue={toLocalDateTime(task?.due_at)}
              aria-invalid={Boolean(state.fieldErrors?.dueAt)}
            />
            <FieldError errors={state.fieldErrors?.dueAt} />
          </div>
          <FormFeedback state={state} />
          <div className="ml-auto w-full sm:w-40">
            <SubmitButton>
              {isEditing ? "Save changes" : "Create task"}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
