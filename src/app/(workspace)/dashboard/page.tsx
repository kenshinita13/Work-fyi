import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export default async function DashboardPage() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const today = startOfUtcDay();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    dueToday,
    overdue,
    activeProjects,
    recentActivity,
    recentProjects,
    taskStatuses,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id)
      .gte("due_at", today.toISOString())
      .lt("due_at", tomorrow.toISOString())
      .not("status", "in", "(done,cancelled)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id)
      .lt("due_at", today.toISOString())
      .not("status", "in", "(done,cancelled)"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id)
      .eq("status", "active"),
    supabase
      .from("activity_logs")
      .select("id, action, created_at")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id, name, status, updated_at")
      .eq("workspace_id", context.workspace.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("status")
      .eq("workspace_id", context.workspace.id)
      .limit(1000),
  ]);

  const taskStatusCounts = {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  };
  taskStatuses.data?.forEach((task) => {
    if (task.status in taskStatusCounts) {
      taskStatusCounts[task.status as keyof typeof taskStatusCounts] += 1;
    }
  });
  const openTasks =
    taskStatusCounts.todo +
    taskStatusCounts.in_progress +
    taskStatusCounts.review;

  const metrics = [
    { label: "Due today", value: dueToday.count ?? 0, icon: Clock3 },
    { label: "Overdue", value: overdue.count ?? 0, icon: AlertCircle },
    {
      label: "Active projects",
      value: activeProjects.count ?? 0,
      icon: FolderKanban,
    },
    { label: "Open tasks", value: openTasks, icon: ListTodo },
  ];

  const isEmpty =
    metrics.every((metric) => metric.value === 0) &&
    !recentActivity.data?.length &&
    !recentProjects.data?.length;
  const canManage = canManageProjects(context.membership.role);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
        </div>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
          Workspace protected
        </Badge>
      </div>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Workspace metrics"
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-semibold">
                    {metric.value}
                  </p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/12 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section
        className="mt-6 border-y py-4"
        aria-labelledby="task-status-title"
      >
        <h2 id="task-status-title" className="text-sm font-semibold">
          Tasks by status
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["To do", taskStatusCounts.todo],
            ["In progress", taskStatusCounts.in_progress],
            ["Review", taskStatusCounts.review],
            ["Done", taskStatusCounts.done],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isEmpty ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center py-14 text-center">
          <span className="mb-5 flex size-12 items-center justify-center rounded-md border border-border bg-card text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">Your workspace is ready</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create your first project to organize work, track progress, and
            build a shared activity history.
          </p>
          {canManage && (
            <Link
              href="/projects?new=1"
              className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              Create a project
            </Link>
          )}
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {recentActivity.data?.map((event) => (
                  <li
                    key={event.id}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>{event.action.replaceAll(".", " ")}</span>
                    <time className="font-mono text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString("en-US")}
                    </time>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recently updated projects</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {recentProjects.data?.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className="truncate font-medium hover:text-primary"
                    >
                      {project.name}
                    </Link>
                    <Badge variant="secondary">{project.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
