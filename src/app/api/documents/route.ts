import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import {
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_BYTES,
  MAX_EDITABLE_DOCUMENT_BYTES,
} from "@/lib/documents/constants";
import {
  validateDocumentFileMetadata,
  validateDocumentSignature,
} from "@/lib/documents/files";
import { importRichDocument, importSpreadsheet } from "@/lib/documents/office";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import { canManageProjects } from "@/lib/projects/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentUploadFieldsSchema } from "@/lib/validation/document";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = MAX_DOCUMENT_BYTES + 64 * 1024;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorResponse("Request rejected.", 403);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) {
    return errorResponse("Documents must be 10 MB or smaller.", 413);
  }

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }
  if (!canManageProjects(context.membership.role)) {
    return errorResponse("Your workspace role has read-only documents.", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("The upload request is invalid.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("Choose a document to upload.", 400);
  }

  const metadata = validateDocumentFileMetadata(file);
  if (!metadata.success) return errorResponse(metadata.error, 400);

  const signatureError = await validateDocumentSignature(
    file,
    metadata.data.extension,
  );
  if (signatureError) return errorResponse(signatureError, 400);

  const parsedFields = documentUploadFieldsSchema.safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
  });
  if (!parsedFields.success) {
    return errorResponse(
      parsedFields.error.issues[0]?.message ?? "Invalid document links.",
      400,
    );
  }

  const supabase = await createSupabaseServerClient();
  const projectId = parsedFields.data.projectId || null;
  const taskId = parsedFields.data.taskId || null;
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
  const storedMimeType =
    metadata.data.extension === "md"
      ? ("text/markdown" as const)
      : metadata.data.mimeType;
  const editableContent =
    (metadata.data.extension === "txt" || metadata.data.extension === "md") &&
    file.size <= MAX_EDITABLE_DOCUMENT_BYTES
      ? await file.text()
      : null;
  let editorKind: "text" | "rich_document" | "spreadsheet" | null =
    editableContent === null ? null : "text";
  let editorState: unknown = null;

  if (
    metadata.data.extension === "docx" ||
    metadata.data.extension === "xlsx"
  ) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      editorKind =
        metadata.data.extension === "docx" ? "rich_document" : "spreadsheet";
      editorState =
        editorKind === "rich_document"
          ? await importRichDocument(buffer)
          : await importSpreadsheet(buffer);
      const parsedState = parseOfficeEditorState(editorKind, editorState);
      if (!parsedState.success) return errorResponse(parsedState.error, 400);
      editorState = parsedState.data;
    } catch {
      return errorResponse(
        `The ${metadata.data.extension.toUpperCase()} file could not be converted for editing.`,
        400,
      );
    }
  }
  const storagePath = `${context.workspace.id}/${documentId}/source.${metadata.data.extension}`;
  const admin = getSupabaseAdminClient();
  const { error: documentError } = await admin.from("documents").insert({
    id: documentId,
    workspace_id: context.workspace.id,
    project_id: projectId,
    task_id: taskId,
    uploaded_by: context.claims.sub,
    file_name: file.name.trim(),
    storage_path: storagePath,
    mime_type: storedMimeType,
    file_size: file.size,
    editable_content: editableContent,
    editor_kind: editorKind,
    editor_state: editorState as Json | null,
    last_edited_by: editorKind === null ? null : context.claims.sub,
    last_edited_at: editorKind === null ? null : new Date().toISOString(),
  });

  if (documentError) {
    console.error("Document registration failed", {
      code: documentError.code,
      message: documentError.message,
    });
    return errorResponse("We could not register the document.", 500);
  }

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: storedMimeType,
      upsert: false,
    });

  if (uploadError) {
    await admin.from("documents").delete().eq("id", documentId);
    return errorResponse("The document upload could not be completed.", 502);
  }

  await admin.from("activity_logs").insert({
    workspace_id: context.workspace.id,
    actor_id: context.claims.sub,
    action: "document.uploaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: {
      file_name: file.name.trim(),
      mime_type: storedMimeType,
      file_size: file.size,
      project_id: projectId,
      task_id: taskId,
    },
  });

  return NextResponse.json({ id: documentId }, { status: 201 });
}
