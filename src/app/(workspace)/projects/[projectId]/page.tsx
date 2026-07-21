import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckSquare2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArchiveProjectDialog } from "@/components/projects/archive-project-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { RestoreProjectButton } from "@/components/projects/restore-project-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectMutationSchema } from "@/lib/validation/project";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatActivity(action: string) {
  const labels: Record<string, string> = {
    "project.created": "Project created",
    "project.updated": "Project details updated",
    "project.archived": "Project archived",
    "project.restored": "Project restored",
  };

  return labels[action] ?? action.replaceAll(".", " ");
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const { projectId } = await params;
  if (!projectMutationSchema.safeParse({ projectId }).success) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!project) notFound();

  const [tasksResult, activityResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at")
      .eq("workspace_id", context.workspace.id)
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("activity_logs")
      .select("id, action, actor_id, metadata, created_at")
      .eq("workspace_id", context.workspace.id)
      .eq("resource_type", "project")
      .eq("resource_id", project.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const canManage = canManageProjects(context.membership.role);
  const isArchived = project.status === "archived";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-5">
        <Link href="/projects">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Projects
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b pb-6">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            {!canManage && (
              <Badge variant="outline" className="gap-1.5 font-normal">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Read only
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
            {project.name}
          </h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {project.description || "No description has been added."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {isArchived ? (
              <RestoreProjectButton projectId={project.id} />
            ) : (
              <>
                <ProjectFormDialog project={project} />
                <ArchiveProjectDialog projectId={project.id} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CheckSquare2
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Project tasks
            </h2>
            <Badge variant="secondary" className="font-mono font-normal">
              {tasksResult.data?.length ?? 0}
            </Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              {tasksResult.error ? (
                <p className="p-5 text-sm text-destructive">
                  Tasks could not be loaded.
                </p>
              ) : tasksResult.data?.length ? (
                <ul className="divide-y divide-border">
                  {tasksResult.data.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {task.priority} priority
                          {task.due_at
                            ? ` | Due ${new Date(task.due_at).toLocaleDateString("en-US")}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {task.status.replaceAll("_", " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
                  <CheckSquare2
                    className="mb-3 size-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">
                    No tasks in this project
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tasks linked to this project will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Project details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {formatDate(project.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Last updated
                  </dt>
                  <dd className="mt-1 font-mono text-xs">
                    {formatDate(project.updated_at)}
                  </dd>
                </div>
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
                      <time className="mt-1 block font-mono text-xs text-muted-foreground">
                        {formatDate(event.created_at)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  New project changes will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
