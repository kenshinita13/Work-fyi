import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TaskCommentForm } from "@/components/tasks/task-comment-form";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskStatusAction } from "@/components/tasks/task-status-actions";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskOptions } from "@/lib/tasks/options";
import { taskIdSchema } from "@/lib/validation/task";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatActivity(action: string) {
  const labels: Record<string, string> = {
    "task.created": "Task created",
    "task.updated": "Task details updated",
    "task.completed": "Task completed",
    "task.reopened": "Task reopened",
    "task.cancelled": "Task cancelled",
    "task.comment_added": "Comment added",
    "task.comment_updated": "Comment updated",
  };
  return labels[action] ?? action.replaceAll(".", " ");
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const { taskId } = await params;
  if (!taskIdSchema.safeParse({ taskId }).success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();
  if (!task) notFound();

  const [options, subtasksResult, commentsResult, activityResult] =
    await Promise.all([
      getTaskOptions(context.workspace.id),
      supabase
        .from("tasks")
        .select("id, title, status, priority, assigned_to, due_at")
        .eq("workspace_id", context.workspace.id)
        .eq("parent_task_id", task.id)
        .order("created_at"),
      supabase
        .from("task_comments")
        .select("id, author_id, body, created_at, updated_at")
        .eq("workspace_id", context.workspace.id)
        .eq("task_id", task.id)
        .order("created_at"),
      supabase
        .from("activity_logs")
        .select("id, actor_id, action, created_at")
        .eq("workspace_id", context.workspace.id)
        .eq("resource_type", "task")
        .eq("resource_id", task.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const projectNames = new Map(
    options.projects.map((item) => [item.id, item.name]),
  );
  const memberNames = new Map(
    options.members.map((item) => [item.id, item.name]),
  );
  const canManage = canManageProjects(context.membership.role);
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5">
        <Link href="/tasks">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tasks
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b pb-6">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {!canManage && (
              <Badge variant="outline" className="gap-1.5 font-normal">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Read only
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
            {task.title}
          </h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {task.description || "No description has been added."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-start gap-2">
            {!isCancelled && (
              <TaskFormDialog
                task={task}
                projects={options.projects}
                members={options.members}
              />
            )}
            {isDone || isCancelled ? (
              <TaskStatusAction taskId={task.id} status="todo" />
            ) : (
              <>
                <TaskStatusAction taskId={task.id} status="done" />
                <TaskStatusAction taskId={task.id} status="cancelled" />
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className="grid content-start gap-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CheckSquare2
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Subtasks
              </h2>
              {canManage && !isCancelled && (
                <TaskFormDialog
                  projects={options.projects}
                  members={options.members}
                  parentTask={{
                    id: task.id,
                    title: task.title,
                    projectId: task.project_id,
                  }}
                />
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                {subtasksResult.error ? (
                  <p className="p-5 text-sm text-destructive">
                    Subtasks could not be loaded.
                  </p>
                ) : subtasksResult.data?.length ? (
                  <ul className="divide-y divide-border">
                    {subtasksResult.data.map((subtask) => (
                      <li
                        key={subtask.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/tasks/${subtask.id}`}
                            className="truncate text-sm font-medium hover:text-primary"
                          >
                            {subtask.title}
                          </Link>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {formatDate(subtask.due_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <TaskStatusBadge status={subtask.status} />
                          <TaskPriorityBadge priority={subtask.priority} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    No subtasks yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <MessageSquare
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Comments
            </h2>
            <Card>
              <CardContent className="grid gap-5">
                {commentsResult.error ? (
                  <p className="text-sm text-destructive">
                    Comments could not be loaded.
                  </p>
                ) : commentsResult.data?.length ? (
                  <ol className="divide-y divide-border">
                    {commentsResult.data.map((comment) => (
                      <li key={comment.id} className="py-4 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {memberNames.get(comment.author_id) ??
                              "Workspace member"}
                          </p>
                          <time className="font-mono text-xs text-muted-foreground">
                            {formatDate(comment.created_at)}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {comment.body}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No comments yet.
                  </p>
                )}
                {canManage && !isCancelled && (
                  <TaskCommentForm taskId={task.id} />
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Task details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderKanban className="size-3.5" aria-hidden="true" />
                    Project
                  </dt>
                  <dd className="mt-1">
                    {task.project_id
                      ? (projectNames.get(task.project_id) ?? "Project")
                      : "No project"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="size-3.5" aria-hidden="true" />
                    Assignee
                  </dt>
                  <dd className="mt-1">
                    {task.assigned_to
                      ? (memberNames.get(task.assigned_to) ??
                        "Workspace member")
                      : "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {formatDate(task.due_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {formatDate(task.created_at)}
                  </dd>
                </div>
                {task.completed_at && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Completed</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {formatDate(task.completed_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-primary" aria-hidden="true" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityResult.error ? (
                <p className="text-sm text-destructive">
                  Activity could not be loaded.
                </p>
              ) : activityResult.data?.length ? (
                <ol className="border-l border-border pl-4">
                  {activityResult.data.map((event) => (
                    <li key={event.id} className="relative pb-5 last:pb-0">
                      <span className="absolute top-1.5 -left-[19px] size-2 rounded-full bg-primary" />
                      <p className="text-sm font-medium">
                        {formatActivity(event.action)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.actor_id
                          ? (memberNames.get(event.actor_id) ??
                            "Workspace member")
                          : "System"}
                      </p>
                      <time className="mt-1 block font-mono text-xs text-muted-foreground">
                        {formatDate(event.created_at)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Task changes will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
