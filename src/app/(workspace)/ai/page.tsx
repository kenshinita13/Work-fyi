import { ShieldCheck, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { TaskPlanBuilder } from "@/components/ai/task-plan-builder";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AiPlannerPage() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const [projectsResult, tasksResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", context.workspace.id)
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("workspace_id", context.workspace.id)
      .not("status", "in", "(done,cancelled)")
      .is("parent_task_id", null)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  const canPlan = canManageProjects(context.membership.role);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            AI planner
          </h1>
        </div>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          Approval required
        </Badge>
      </div>

      <section className="mt-7" aria-label="AI task planning">
        {!canPlan ? (
          <div className="border-y py-10 text-sm text-muted-foreground">
            Your workspace role has read-only access to AI plans.
          </div>
        ) : projectsResult.error || tasksResult.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Workspace planning context could not be loaded.
          </div>
        ) : (
          <TaskPlanBuilder
            projects={projectsResult.data ?? []}
            parentTasks={(tasksResult.data ?? []).map((task) => ({
              id: task.id,
              title: task.title,
              projectId: task.project_id,
            }))}
          />
        )}
      </section>
    </div>
  );
}
