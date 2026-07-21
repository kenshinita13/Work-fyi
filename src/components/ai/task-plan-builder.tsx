"use client";

import { Check, Clock3, ListTree, RotateCcw, Sparkles } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { approveAiTaskPlanAction } from "@/lib/ai/actions";
import { initialFormState } from "@/lib/auth/form-state";
import type {
  AiTaskPlanRequest,
  GeneratedTaskPlan,
} from "@/lib/validation/ai-task-plan";
import { FormFeedback, SubmitButton } from "@/components/auth/form-parts";
import { MessageResponse } from "@/components/ai-elements/message";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type ProjectOption = { id: string; name: string };
type ParentTaskOption = { id: string; title: string; projectId: string | null };

type DraftResponse = {
  draftId: string;
  expiresAt: string;
  plan: GeneratedTaskPlan;
};

function dueLabel(dueInDays: number | null) {
  if (dueInDays === null) return "No suggested due date";
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}`;
}

export function TaskPlanBuilder({
  projects,
  parentTasks,
}: {
  projects: ProjectOption[];
  parentTasks: ParentTaskOption[];
}) {
  const [mode, setMode] = useState<AiTaskPlanRequest["mode"]>("task_plan");
  const [projectId, setProjectId] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [approvalState, approvalAction] = useActionState(
    approveAiTaskPlanAction,
    initialFormState,
  );

  const visibleParentTasks = useMemo(
    () =>
      projectId
        ? parentTasks.filter((task) => task.projectId === projectId)
        : parentTasks,
    [parentTasks, projectId],
  );

  const taskCount = draft
    ? draft.plan.tasks.reduce(
        (count, task) => count + 1 + task.subtasks.length,
        0,
      )
    : 0;

  function handleModeChange(nextMode: AiTaskPlanRequest["mode"]) {
    setMode(nextMode);
    if (nextMode === "task_plan") setParentTaskId("");
  }

  function resetDraft() {
    setDraft(null);
    setRequestError("");
  }

  async function generatePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setRequestError("");

    try {
      const response = await fetch("/api/ai/task-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt, projectId, parentTaskId }),
      });
      const result = (await response.json()) as DraftResponse & {
        error?: string;
      };

      if (!response.ok) {
        setRequestError(result.error ?? "We could not generate a task plan.");
        return;
      }

      setDraft(result);
    } catch {
      setRequestError("The planning service could not be reached.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (draft) {
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Draft</Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
                Expires{" "}
                {new Date(draft.expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{draft.plan.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {taskCount} task{taskCount === 1 ? "" : "s"} ready for approval
            </p>
          </div>
          <Button type="button" variant="outline" onClick={resetDraft}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Generate another
          </Button>
        </div>

        <ol className="grid gap-4">
          {draft.plan.tasks.map((task, index) => (
            <li
              key={`${task.title}-${index}`}
              className="rounded-md border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Task {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">{task.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TaskPriorityBadge priority={task.priority} />
                  <Badge variant="outline" className="font-normal">
                    {dueLabel(task.dueInDays)}
                  </Badge>
                </div>
              </div>
              {task.description && (
                <MessageResponse className="mt-3 text-sm text-muted-foreground">
                  {task.description}
                </MessageResponse>
              )}
              {task.subtasks.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ListTree className="size-3.5" aria-hidden="true" />
                    Subtasks
                  </p>
                  <ul className="divide-y">
                    {task.subtasks.map((subtask, subtaskIndex) => (
                      <li
                        key={`${subtask.title}-${subtaskIndex}`}
                        className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{subtask.title}</p>
                          {subtask.description && (
                            <MessageResponse className="mt-1 text-xs text-muted-foreground">
                              {subtask.description}
                            </MessageResponse>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TaskPriorityBadge priority={subtask.priority} />
                          <span className="text-xs text-muted-foreground">
                            {dueLabel(subtask.dueInDays)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>

        <form action={approvalAction} className="border-t pt-5">
          <input type="hidden" name="draftId" value={draft.draftId} />
          <FormFeedback state={approvalState} />
          <div className="mt-4 ml-auto w-full sm:w-56">
            <SubmitButton>
              <Check className="size-4" aria-hidden="true" />
              Approve and create
            </SubmitButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={generatePlan} className="grid max-w-3xl gap-5">
      <div className="grid gap-2">
        <Label>Planning mode</Label>
        <div className="grid grid-cols-2 gap-2" role="group">
          <Button
            type="button"
            variant={mode === "task_plan" ? "default" : "outline"}
            onClick={() => handleModeChange("task_plan")}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Task plan
          </Button>
          <Button
            type="button"
            variant={mode === "subtasks" ? "default" : "outline"}
            onClick={() => handleModeChange("subtasks")}
          >
            <ListTree className="size-4" aria-hidden="true" />
            Subtasks
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ai-project">Project</Label>
          <Select
            value={projectId || "none"}
            onValueChange={(value) => {
              setProjectId(value === "none" ? "" : value);
              setParentTaskId("");
            }}
          >
            <SelectTrigger id="ai-project" className="w-full">
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
        </div>

        {mode === "subtasks" ? (
          <div className="grid gap-2">
            <Label htmlFor="ai-parent-task">Parent task</Label>
            <Select
              value={parentTaskId || "none"}
              onValueChange={(value) =>
                setParentTaskId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="ai-parent-task" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a task</SelectItem>
                {visibleParentTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="ai-plan-name">Plan focus</Label>
            <Input id="ai-plan-name" value="Tasks and subtasks" disabled />
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ai-prompt">Outcome</Label>
        <Textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          minLength={10}
          maxLength={4000}
          rows={8}
          placeholder="Describe the result, constraints, and deadline."
          required
        />
        <span className="text-right font-mono text-xs text-muted-foreground">
          {prompt.length}/4000
        </span>
      </div>

      {requestError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {requestError}
        </p>
      )}

      <div className="w-full sm:w-48">
        <Button
          type="submit"
          className="w-full"
          disabled={isGenerating || (mode === "subtasks" && !parentTaskId)}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {isGenerating ? "Planning..." : "Generate draft"}
        </Button>
      </div>
    </form>
  );
}
