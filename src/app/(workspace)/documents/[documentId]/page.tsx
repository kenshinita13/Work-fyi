import { ArrowLeft, FileText, LockKeyhole, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentActions } from "@/components/documents/document-actions";
import { DocumentEditor } from "@/components/documents/document-editor";
import { DocumentShareDialog } from "@/components/documents/document-share-dialog";
import { PresentationEditor } from "@/components/documents/presentation-editor";
import { RichDocumentEditor } from "@/components/documents/rich-document-editor";
import { SpreadsheetEditor } from "@/components/documents/spreadsheet-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  canEditDocument,
  canManageDocumentSharing,
} from "@/lib/documents/permissions";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import type {
  PresentationState,
  RichDocumentState,
  SpreadsheetState,
} from "@/lib/documents/office-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const { documentId } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: document }, { data: ownShare }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, uploaded_by, file_name, mime_type, file_size, visibility, editable_content, editor_kind, editor_state, content_revision, last_edited_at, summary_draft",
      )
      .eq("id", documentId)
      .eq("workspace_id", context.workspace.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("document_shares")
      .select("permission")
      .eq("document_id", documentId)
      .eq("user_id", context.claims.sub)
      .maybeSingle(),
  ]);
  if (!document) notFound();

  const canEdit = canEditDocument(
    context.membership.role,
    context.claims.sub,
    {
      uploadedBy: document.uploaded_by,
      visibility: document.visibility,
    },
    ownShare?.permission ?? null,
  );
  const canShare = canManageDocumentSharing(
    context.membership.role,
    context.claims.sub,
    document.uploaded_by,
  );

  let shareMembers: Array<{
    userId: string;
    name: string;
    role: typeof context.membership.role;
  }> = [];
  let currentShares: Array<{
    userId: string;
    permission: "viewer" | "editor";
  }> = [];

  if (canShare) {
    const [membersResult, sharesResult] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", context.workspace.id)
        .neq("user_id", context.claims.sub)
        .order("created_at"),
      supabase
        .from("document_shares")
        .select("user_id, permission")
        .eq("document_id", document.id),
    ]);
    const memberships = membersResult.data ?? [];
    const profileIds = memberships.map((membership) => membership.user_id);
    const { data: profiles } = profileIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds)
      : { data: [] };
    const names = new Map(
      profiles?.map((profile) => [profile.id, profile.full_name]) ?? [],
    );

    shareMembers = memberships.map((membership) => ({
      userId: membership.user_id,
      name: names.get(membership.user_id) || "Workspace member",
      role: membership.role,
    }));
    currentShares = (sharesResult.data ?? []).map((share) => ({
      userId: share.user_id,
      permission: share.permission,
    }));
  }

  const officeState =
    document.editor_kind &&
    document.editor_kind !== "text" &&
    document.editor_state
      ? parseOfficeEditorState(document.editor_kind, document.editor_state)
      : null;
  const editable =
    document.editor_kind === "text"
      ? document.editable_content !== null
      : officeState?.success === true;
  const format = document.mime_type === "text/markdown" ? "md" : "txt";

  return (
    <div className="min-h-full bg-muted/20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild title="Back to documents">
          <Link href="/documents">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Back to documents</span>
          </Link>
        </Button>
        <FileText className="size-5 text-primary" aria-hidden="true" />
        <div className="min-w-48 flex-1">
          <h1 className="truncate text-lg font-semibold">
            {document.file_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 font-normal">
          {document.visibility === "restricted" ? (
            <LockKeyhole className="size-3.5" aria-hidden="true" />
          ) : (
            <Users className="size-3.5" aria-hidden="true" />
          )}
          {document.visibility === "restricted" ? "Restricted" : "Workspace"}
        </Badge>
        {canShare && (
          <DocumentShareDialog
            documentId={document.id}
            initialVisibility={document.visibility}
            members={shareMembers}
            initialShares={currentShares}
          />
        )}
        <DocumentActions
          documentId={document.id}
          fileName={document.file_name}
          summary={document.summary_draft}
          canSummarize={canEdit}
          canDelete={canShare}
        />
      </div>

      {editable && document.editor_kind === "text" ? (
        <DocumentEditor
          documentId={document.id}
          initialFileName={document.file_name}
          initialContent={document.editable_content ?? ""}
          initialRevision={document.content_revision}
          format={format}
          canEdit={canEdit}
        />
      ) : editable &&
        document.editor_kind === "rich_document" &&
        officeState?.success ? (
        <RichDocumentEditor
          documentId={document.id}
          initialFileName={document.file_name}
          initialState={officeState.data as RichDocumentState}
          initialRevision={document.content_revision}
          canEdit={canEdit}
        />
      ) : editable &&
        document.editor_kind === "spreadsheet" &&
        officeState?.success ? (
        <SpreadsheetEditor
          documentId={document.id}
          initialFileName={document.file_name}
          initialState={officeState.data as SpreadsheetState}
          initialRevision={document.content_revision}
          canEdit={canEdit}
        />
      ) : editable &&
        document.editor_kind === "presentation" &&
        officeState?.success ? (
        <PresentationEditor
          documentId={document.id}
          initialFileName={document.file_name}
          initialState={officeState.data as PresentationState}
          initialRevision={document.content_revision}
          canEdit={canEdit}
        />
      ) : (
        <div className="border-t px-4 py-20 sm:px-6">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <FileText
              className="size-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold">Preview unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Export this file to open it in its native application. DOCX and
              XLSX imports become editable; imported PPTX files keep their
              original layout and remain export-only.
            </p>
            <Button className="mt-5" asChild>
              <a href={`/api/documents/${document.id}/download`}>Export file</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
