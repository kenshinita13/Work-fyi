import {
  CalendarClock,
  KanbanSquare,
  List,
  ListTodo,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getTaskOptions } from "@/lib/tasks/options";
import { taskFiltersSchema } from "@/lib/validation/task";
import type { Task, TaskStatus } from "@/types/database";

const statusOptions = [
  { value: "current", label: "Current statuses" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All statuses" },
] as const;

const priorityOptions = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const scopes = [
  { value: "all", label: "All tasks", icon: ListTodo },
  { value: "mine", label: "My tasks", icon: UserRound },
  { value: "due_today", label: "Due today", icon: CalendarClock },
  { value: "overdue", label: "Overdue", icon: CalendarClock },
  { value: "completed", label: "Completed", icon: ListTodo },
] as const;

const boardColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
];

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function taskUrl(params: {
  query: string;
  status: string;
  priority: string;
  scope: string;
  view: string;
  projectId: string;
}) {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.status !== "current") search.set("status", params.status);
  if (params.priority !== "all") search.set("priority", params.priority);
  if (params.scope !== "all") search.set("scope", params.scope);
  if (params.view !== "list") search.set("view", params.view);
  if (params.projectId) search.set("projectId", params.projectId);
  const query = search.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const rawParams = await searchParams;
  const parsedFilters = taskFiltersSchema.safeParse({
    query: typeof rawParams.query === "string" ? rawParams.query : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
    priority:
      typeof rawParams.priority === "string" ? rawParams.priority : undefined,
    scope: typeof rawParams.scope === "string" ? rawParams.scope : undefined,
    view: typeof rawParams.view === "string" ? rawParams.view : undefined,
    projectId:
      typeof rawParams.projectId === "string" ? rawParams.projectId : undefined,
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        query: "",
        status: "current" as const,
        priority: "all" as const,
        scope: "all" as const,
        view: "list" as const,
        projectId: "",
      };

  const supabase = await createSupabaseServerClient();
  const options = await getTaskOptions(context.workspace.id);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (filters.scope === "completed") {
    query = query.eq("status", "done");
  } else if (filters.status === "current") {
    query = query.neq("status", "cancelled");
  } else if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.scope === "mine") {
    query = query.eq("assigned_to", context.claims.sub);
  } else if (filters.scope === "due_today") {
    query = query
      .gte("due_at", startToday.toISOString())
      .lt("due_at", endToday.toISOString())
      .not("status", "in", "(done,cancelled)");
  } else if (filters.scope === "overdue") {
    query = query
      .lt("due_at", now.toISOString())
      .not("status", "in", "(done,cancelled)");
  }

  if (filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.query) {
    query = query.ilike("title", `%${escapeLikePattern(filters.query)}%`);
  }

  const { data: tasks, error } = await query;
  const canManage = canManageProjects(context.membership.role);
  const projectNames = new Map(
    options.projects.map((item) => [item.id, item.name]),
  );
  const memberNames = new Map(
    options.members.map((item) => [item.id, item.name]),
  );
  const hasFilters =
    filters.query ||
    filters.status !== "current" ||
    filters.priority !== "all" ||
    filters.scope !== "all" ||
    filters.projectId;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Tasks</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Move work from a clear next action to a documented outcome.
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
            <TaskFormDialog
              projects={options.projects}
              members={options.members}
              initialProjectId={filters.projectId || undefined}
              defaultOpen={rawParams.new === "1"}
            />
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <nav
          className="flex max-w-full gap-1 overflow-x-auto"
          aria-label="Task scope"
        >
          {scopes.map((scope) => {
            const Icon = scope.icon;
            const active = filters.scope === scope.value;
            return (
              <Button
                key={scope.value}
                asChild
                size="sm"
                variant={active ? "secondary" : "ghost"}
              >
                <Link href={taskUrl({ ...filters, scope: scope.value })}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {scope.label}
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="flex rounded-lg border p-0.5" aria-label="Task view">
          <Button
            asChild
            size="sm"
            variant={filters.view === "list" ? "secondary" : "ghost"}
          >
            <Link href={taskUrl({ ...filters, view: "list" })}>
              <List className="size-3.5" aria-hidden="true" />
              List
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={filters.view === "board" ? "secondary" : "ghost"}
          >
            <Link href={taskUrl({ ...filters, view: "board" })}>
              <KanbanSquare className="size-3.5" aria-hidden="true" />
              Board
            </Link>
          </Button>
        </div>
      </div>

      <form
        method="get"
        className="grid gap-3 border-b py-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_220px_auto]"
      >
        <input type="hidden" name="scope" value={filters.scope} />
        <input type="hidden" name="view" value={filters.view} />
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="query"
            defaultValue={filters.query}
            placeholder="Search task titles"
            className="pl-9"
            maxLength={100}
            aria-label="Search task titles"
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
        <Select name="priority" defaultValue={filters.priority}>
          <SelectTrigger className="w-full" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="projectId" defaultValue={filters.projectId || "none"}>
          <SelectTrigger className="w-full" aria-label="Filter by project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All projects</SelectItem>
            {options.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {error || options.error ? (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Tasks could not be loaded. Refresh the page to try again.
        </div>
      ) : tasks?.length ? (
        filters.view === "board" ? (
          <div className="mt-5 grid gap-4 overflow-x-auto pb-3 lg:grid-cols-5">
            {boardColumns.map((column) => {
              const columnTasks = tasks.filter(
                (task) => task.status === column.status,
              );
              return (
                <section key={column.status} className="min-w-64 lg:min-w-0">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold">{column.label}</h2>
                    <Badge
                      variant="secondary"
                      className="font-mono font-normal"
                    >
                      {columnTasks.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {columnTasks.map((task) => (
                      <Card key={task.id} size="sm">
                        <CardHeader>
                          <CardTitle>
                            <Link
                              href={`/tasks/${task.id}`}
                              className="line-clamp-2 hover:text-primary"
                            >
                              {task.title}
                            </Link>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                          <div className="flex flex-wrap gap-2">
                            <TaskPriorityBadge priority={task.priority} />
                            {task.project_id && (
                              <Badge
                                variant="secondary"
                                className="max-w-full truncate"
                              >
                                {projectNames.get(task.project_id) ?? "Project"}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {task.assigned_to
                              ? (memberNames.get(task.assigned_to) ??
                                "Workspace member")
                              : "Unassigned"}
                          </p>
                          <time className="font-mono text-xs text-muted-foreground">
                            {formatDate(task.due_at)}
                          </time>
                        </CardContent>
                      </Card>
                    ))}
                    {!columnTasks.length && (
                      <div className="flex h-24 items-center justify-center border-y text-xs text-muted-foreground">
                        No tasks
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mt-5 hidden overflow-hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="max-w-xl">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {task.title}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {task.project_id
                            ? (projectNames.get(task.project_id) ?? "Project")
                            : "No project"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.assigned_to
                          ? (memberNames.get(task.assigned_to) ??
                            "Workspace member")
                          : "Unassigned"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDate(task.due_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-5 grid gap-3 md:hidden">
              {tasks.map((task) => (
                <TaskMobileCard
                  key={task.id}
                  task={task}
                  assignee={
                    task.assigned_to
                      ? (memberNames.get(task.assigned_to) ??
                        "Workspace member")
                      : "Unassigned"
                  }
                />
              ))}
            </div>
          </>
        )
      ) : (
        <section className="flex min-h-80 flex-col items-center justify-center py-14 text-center">
          <ListTodo
            className="mb-4 size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold">
            {hasFilters ? "No matching tasks" : "No tasks yet"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {hasFilters
              ? "Adjust the filters to widen the task list."
              : canManage
                ? "Create the first task for this workspace."
                : "No tasks have been assigned in this workspace."}
          </p>
          {hasFilters && (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/tasks">Clear filters</Link>
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function TaskMobileCard({ task, assignee }: { task: Task; assignee: string }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <Link
          href={`/tasks/${task.id}`}
          className="font-medium hover:text-primary"
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{assignee}</span>
          <time className="shrink-0 font-mono">{formatDate(task.due_at)}</time>
        </div>
      </CardContent>
    </Card>
  );
}
