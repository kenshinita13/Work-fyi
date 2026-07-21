import { FolderKanban, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkspaceContext } from "@/lib/auth/session";
import { escapeLikePattern } from "@/lib/projects/filters";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectFiltersSchema } from "@/lib/validation/project";

const statusOptions = [
  { value: "current", label: "Current projects" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const rawParams = await searchParams;
  const parsedFilters = projectFiltersSchema.safeParse({
    query: typeof rawParams.query === "string" ? rawParams.query : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { query: "", status: "current" as const };

  const supabase = await createSupabaseServerClient();
  let projectsQuery = supabase
    .from("projects")
    .select(
      "id, workspace_id, name, description, status, created_by, created_at, updated_at",
    )
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (filters.status === "current") {
    projectsQuery = projectsQuery.neq("status", "archived");
  } else if (filters.status !== "all") {
    projectsQuery = projectsQuery.eq("status", filters.status);
  }

  if (filters.query) {
    projectsQuery = projectsQuery.ilike(
      "name",
      `%${escapeLikePattern(filters.query)}%`,
    );
  }

  const { data: projects, error } = await projectsQuery;
  const canManage = canManageProjects(context.membership.role);
  const hasFilters = filters.query || filters.status !== "current";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize active work and keep its history close at hand.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canManage && (
            <Badge variant="outline" className="gap-1.5 font-normal">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Read only
            </Badge>
          )}
          {canManage && (
            <ProjectFormDialog defaultOpen={rawParams.new === "1"} />
          )}
        </div>
      </div>

      <form
        method="get"
        className="mt-7 grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="query"
            defaultValue={filters.query}
            placeholder="Search project names"
            className="pl-9"
            maxLength={100}
            aria-label="Search project names"
          />
        </div>
        <Select name="status" defaultValue={filters.status}>
          <SelectTrigger className="w-full" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {error ? (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Projects could not be loaded. Refresh the page to try again.
        </div>
      ) : projects?.length ? (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-lg">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {project.description || "No description"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDate(project.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/projects/${project.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {projects.map((project) => (
              <Card key={project.id} size="sm">
                <CardContent className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="min-w-0 truncate font-medium hover:text-primary"
                    >
                      {project.name}
                    </Link>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.description || "No description"}
                  </p>
                  <time className="font-mono text-xs text-muted-foreground">
                    Updated {formatDate(project.updated_at)}
                  </time>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <section className="flex min-h-80 flex-col items-center justify-center py-14 text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-md border bg-card text-primary">
            <FolderKanban className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold">
            {hasFilters ? "No matching projects" : "No projects yet"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {hasFilters
              ? "Try a different name or status filter."
              : canManage
                ? "Create the first project for this workspace."
                : "A workspace manager has not created a project yet."}
          </p>
          {hasFilters && (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/projects">Clear filters</Link>
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
