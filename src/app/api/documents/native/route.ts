import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import {
  DOCUMENT_BUCKET,
  MAX_EDITABLE_DOCUMENT_BYTES,
  OFFICE_DOCUMENT_MIME_TYPES,
} from "@/lib/documents/constants";
import { exportOfficeEditorState } from "@/lib/documents/office";
import {
  createPresentationState,
  createRichDocumentState,
  createSpreadsheetState,
} from "@/lib/documents/office-types";
import { canManageProjects } from "@/lib/projects/permissions";
import { isRequestSameOrigin } from "@/lib/http/origin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentCreateSchema } from "@/lib/validation/document";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type NativeFormat = "txt" | "md" | "docx" | "xlsx" | "pptx";

function withExtension(fileName: string, format: NativeFormat) {
  const trimmed = fileName.trim();
  return trimmed.toLowerCase().endsWith(`.${format}`)
    ? trimmed
    : `${trimmed}.${format}`;
}

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request))
    return errorResponse("Request rejected.", 403);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EDITABLE_DOCUMENT_BYTES + 64 * 1024) {
    return errorResponse("The document request is too large.", 413);
  }

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }
  if (!canManageProjects(context.membership.role)) {
    return errorResponse("Your workspace role has read-only documents.", 403);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("The document request is invalid.", 400);
  }

  const parsed = documentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message ?? "The document request is invalid.",
      400,
    );
  }

  const projectId = parsed.data.projectId || null;
  const taskId = parsed.data.taskId || null;
  const supabase = await createSupabaseServerClient();
  const [projectResult, taskResult] = await Promise.all([
    projectId
      ? supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("workspace_id", context.workspace.id)
          .neq("status", "archived")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    taskId
      ? supabase
          .from("tasks")
          .select("id, project_id")
          .eq("id", taskId)
          .eq("workspace_id", context.workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (projectId && !projectResult.data) {
    return errorResponse("Project not found.", 404);
  }
  if (taskId && !taskResult.data) {
    return errorResponse("Task not found.", 404);
  }
  if (
    projectId &&
    taskResult.data &&
    taskResult.data.project_id !== projectId
  ) {
    return errorResponse("The task belongs to another project.", 400);
  }

  const documentId = randomUUID();
  const fileName = withExtension(parsed.data.fileName, parsed.data.format);
  const format = parsed.data.format;
  const officeState =
    format === "docx"
      ? createRichDocumentState()
      : format === "xlsx"
        ? createSpreadsheetState()
        : format === "pptx"
          ? createPresentationState()
          : null;
  const officeKind =
    format === "docx"
      ? ("rich_document" as const)
      : format === "xlsx"
        ? ("spreadsheet" as const)
        : format === "pptx"
          ? ("presentation" as const)
          : null;
  const editorKind = officeKind ?? ("text" as const);
  const mimeType =
    format === "md"
      ? ("text/markdown" as const)
      : format === "txt"
        ? ("text/plain" as const)
        : OFFICE_DOCUMENT_MIME_TYPES[format];
  const editableContent = "content" in parsed.data ? parsed.data.content : null;
  const bytes =
    officeState && officeKind
      ? await exportOfficeEditorState(officeKind, officeState)
      : new TextEncoder().encode(editableContent ?? "");
  const storageBytes =
    bytes.byteLength === 0 ? new TextEncoder().encode("\n") : bytes;
  const storagePath = `${context.workspace.id}/${documentId}/source.${parsed.data.format}`;
  const editedAt = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const { error: documentError } = await admin.from("documents").insert({
    id: documentId,
    workspace_id: context.workspace.id,
    project_id: projectId,
    task_id: taskId,
    uploaded_by: context.claims.sub,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size: bytes.byteLength,
    editable_content: editableContent,
    editor_kind: editorKind,
    editor_state: officeState,
    last_edited_by: context.claims.sub,
    last_edited_at: editedAt,
  });

  if (documentError) {
    console.error("Native document registration failed", {
      code: documentError.code,
      message: documentError.message,
    });
    return errorResponse("We could not create the document.", 500);
  }

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, storageBytes, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    await admin.from("documents").delete().eq("id", documentId);
    return errorResponse("The document could not be saved.", 502);
  }

  await admin.from("activity_logs").insert({
    workspace_id: context.workspace.id,
    actor_id: context.claims.sub,
    action: "document.created",
    resource_type: "document",
    resource_id: documentId,
    metadata: {
      file_name: fileName,
      mime_type: mimeType,
      project_id: projectId,
      task_id: taskId,
    },
  });

  return NextResponse.json({ id: documentId, revision: 1 }, { status: 201 });
}
