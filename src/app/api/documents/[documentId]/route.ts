import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { DOCUMENT_BUCKET } from "@/lib/documents/constants";
import { exportOfficeEditorState } from "@/lib/documents/office";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import {
  canEditDocument,
  canManageDocumentSharing,
} from "@/lib/documents/permissions";
import { canManageProjects } from "@/lib/projects/permissions";
import { isRequestSameOrigin } from "@/lib/http/origin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  documentIdSchema,
  documentSaveSchema,
} from "@/lib/validation/document";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isRequestSameOrigin(request))
    return errorResponse("Request rejected.", 403);

  const parsedId = documentIdSchema.safeParse(await params);
  if (!parsedId.success) return errorResponse("Document not found.", 404);

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("The save request is invalid.", 400);
  }

  const parsedBody = documentSaveSchema.safeParse(payload);
  if (!parsedBody.success) {
    return errorResponse(
      parsedBody.error.issues[0]?.message ?? "The save request is invalid.",
      400,
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: document }, { data: ownShare }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, uploaded_by, visibility, mime_type, editable_content, editor_kind, editor_state, content_revision",
      )
      .eq("id", parsedId.data.documentId)
      .eq("workspace_id", context.workspace.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("document_shares")
      .select("permission")
      .eq("document_id", parsedId.data.documentId)
      .eq("user_id", context.claims.sub)
      .maybeSingle(),
  ]);

  if (!document) return errorResponse("Document not found.", 404);
  if (
    !canEditDocument(
      context.membership.role,
      context.claims.sub,
      {
        uploadedBy: document.uploaded_by,
        visibility: document.visibility,
      },
      ownShare?.permission ?? null,
    )
  ) {
    return errorResponse("You have read-only access to this document.", 403);
  }
  if (!document.editor_kind) {
    return errorResponse("This file type cannot be edited in the app.", 400);
  }
  if (parsedBody.data.editorKind !== document.editor_kind) {
    return errorResponse("The editor type does not match this document.", 400);
  }

  const extension =
    document.editor_kind === "rich_document"
      ? ".docx"
      : document.editor_kind === "spreadsheet"
        ? ".xlsx"
        : document.editor_kind === "presentation"
          ? ".pptx"
          : document.mime_type === "text/markdown"
            ? ".md"
            : ".txt";
  const requestedName = parsedBody.data.fileName.trim();
  const fileName = requestedName.toLowerCase().endsWith(extension)
    ? requestedName
    : `${requestedName}${extension}`;
  const officeState =
    parsedBody.data.editorKind === "text"
      ? null
      : parseOfficeEditorState(
          parsedBody.data.editorKind,
          parsedBody.data.editorState,
        );
  if (officeState && !officeState.success) {
    return errorResponse(officeState.error, 400);
  }
  const editableContent =
    parsedBody.data.editorKind === "text" ? parsedBody.data.content : null;
  const editorState = officeState?.success ? officeState.data : null;
  const bytes =
    parsedBody.data.editorKind === "text"
      ? new TextEncoder().encode(parsedBody.data.content)
      : await exportOfficeEditorState(parsedBody.data.editorKind, editorState!);
  const editedAt = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("documents")
    .update({
      file_name: fileName,
      file_size: bytes.byteLength,
      editable_content: editableContent,
      editor_state: editorState,
      content_revision: parsedBody.data.expectedRevision + 1,
      last_edited_by: context.claims.sub,
      last_edited_at: editedAt,
    })
    .eq("id", document.id)
    .eq("workspace_id", context.workspace.id)
    .eq("content_revision", parsedBody.data.expectedRevision)
    .is("deleted_at", null)
    .select("content_revision, updated_at")
    .maybeSingle();

  if (updateError) {
    return errorResponse("The document could not be saved.", 500);
  }
  if (!updated) {
    return errorResponse(
      "This document changed elsewhere. Reload before saving again.",
      409,
    );
  }

  await admin.from("activity_logs").insert({
    workspace_id: context.workspace.id,
    actor_id: context.claims.sub,
    action: "document.edited",
    resource_type: "document",
    resource_id: document.id,
    metadata: {
      file_name: fileName,
      content_revision: updated.content_revision,
    },
  });

  return NextResponse.json({
    revision: updated.content_revision,
    updatedAt: updated.updated_at,
    fileName,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isRequestSameOrigin(request))
    return errorResponse("Request rejected.", 403);

  const parsed = documentIdSchema.safeParse(await params);
  if (!parsed.success) return errorResponse("Document not found.", 404);

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }
  if (!canManageProjects(context.membership.role)) {
    return errorResponse("Your workspace role has read-only documents.", 403);
  }

  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, storage_path, file_name, uploaded_by")
    .eq("id", parsed.data.documentId)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return errorResponse("Document not found.", 404);
  if (
    !canManageDocumentSharing(
      context.membership.role,
      context.claims.sub,
      document.uploaded_by,
    )
  ) {
    return errorResponse("Only the document owner can delete this file.", 403);
  }

  const { error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([document.storage_path]);
  if (storageError) {
    return errorResponse("We could not remove the document file.", 502);
  }

  const deletedAt = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const { error: documentError } = await admin
    .from("documents")
    .update({ deleted_at: deletedAt, deleted_by: context.claims.sub })
    .eq("id", document.id)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null);
  if (documentError) {
    return errorResponse(
      "The document file was removed, but cleanup failed.",
      500,
    );
  }

  await admin.from("activity_logs").insert({
    workspace_id: context.workspace.id,
    actor_id: context.claims.sub,
    action: "document.deleted",
    resource_type: "document",
    resource_id: document.id,
    metadata: { file_name: document.file_name },
  });

  return NextResponse.json({ deleted: true });
}
