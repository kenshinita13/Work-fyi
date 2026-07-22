import { ArrowLeft, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentEditor } from "@/components/documents/document-editor";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewDocumentPage() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");
  if (!canManageProjects(context.membership.role)) redirect("/documents");

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
      .neq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  const projects = projectsResult.data ?? [];
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <div className="min-h-full bg-muted/20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild title="Back to documents">
          <Link href="/documents">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Back to documents</span>
          </Link>
        </Button>
        <FilePlus2 className="size-5 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold">New document</h1>
          <p className="text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
        </div>
      </div>
      <DocumentEditor
        projects={projects}
        tasks={(tasksResult.data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          projectName: task.project_id
            ? (projectNames.get(task.project_id) ?? null)
            : null,
        }))}
      />
    </div>
  );
}
