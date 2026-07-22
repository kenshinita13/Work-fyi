import { FilePlus2, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentActions } from "@/components/documents/document-actions";
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  canEditDocument,
  canManageDocumentSharing,
} from "@/lib/documents/permissions";
import { canManageProjects } from "@/lib/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function fileTypeLabel(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml")) return "DOCX";
  if (mimeType.includes("spreadsheetml")) return "XLSX";
  if (mimeType.includes("presentationml")) return "PPTX";
  if (mimeType === "text/markdown") return "Markdown";
  return "Text";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [documentsResult, projectsResult, tasksResult, sharesResult] =
    await Promise.all([
      supabase
        .from("documents")
        .select(
          "id, project_id, task_id, uploaded_by, file_name, mime_type, file_size, visibility, editable_content, summary_draft, summary_generated_at, created_at",
        )
        .eq("workspace_id", context.workspace.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
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
      supabase
        .from("document_shares")
        .select("document_id, permission")
        .eq("user_id", context.claims.sub),
    ]);

  const documents = documentsResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  const taskNames = new Map(tasks.map((task) => [task.id, task.title]));
  const ownSharePermissions = new Map(
    sharesResult.data?.map((share) => [share.document_id, share.permission]) ??
      [],
  );
  const canManage = canManageProjects(context.membership.role);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
            <FileText className="size-5 text-primary" aria-hidden="true" />
            Documents
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            Private workspace files
          </Badge>
          {canManage && (
            <>
              <Button variant="outline" asChild>
                <Link href="/documents/new">
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  New document
                </Link>
              </Button>
              <DocumentUploadDialog
                projects={projects}
                tasks={tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  projectName: task.project_id
                    ? (projectNames.get(task.project_id) ?? null)
                    : null,
                }))}
                defaultOpen={params.new === "1"}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-7 overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Linked work</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => {
                const ownPermission =
                  ownSharePermissions.get(document.id) ?? null;
                const canEdit = canEditDocument(
                  context.membership.role,
                  context.claims.sub,
                  {
                    uploadedBy: document.uploaded_by,
                    visibility: document.visibility,
                  },
                  ownPermission,
                );
                const canDelete = canManageDocumentSharing(
                  context.membership.role,
                  context.claims.sub,
                  document.uploaded_by,
                );

                return (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="min-w-48">
                        <Link
                          href={`/documents/${document.id}`}
                          className="max-w-sm truncate font-medium"
                          title={document.file_name}
                        >
                          {document.file_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {fileTypeLabel(document.mime_type)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid min-w-36 gap-1 text-sm">
                        {document.project_id && (
                          <Link
                            href={`/projects/${document.project_id}`}
                            className="text-primary hover:underline"
                          >
                            {projectNames.get(document.project_id) ?? "Project"}
                          </Link>
                        )}
                        {document.task_id && (
                          <Link
                            href={`/tasks/${document.task_id}`}
                            className="text-primary hover:underline"
                          >
                            {taskNames.get(document.task_id) ?? "Task"}
                          </Link>
                        )}
                        {!document.project_id && !document.task_id && (
                          <span className="text-muted-foreground">
                            Workspace
                          </span>
                        )}
                        <Badge variant="outline" className="w-fit font-normal">
                          {document.visibility === "restricted"
                            ? "Restricted"
                            : "Workspace"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(document.file_size)}</TableCell>
                    <TableCell>{formatDate(document.created_at)}</TableCell>
                    <TableCell>
                      {document.summary_draft ? (
                        <Badge variant="secondary">Draft</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DocumentActions
                        documentId={document.id}
                        fileName={document.file_name}
                        summary={document.summary_draft}
                        canSummarize={canEdit}
                        canDelete={canDelete}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <p className="font-medium">No documents yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Workspace files will appear here after upload.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
