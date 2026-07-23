import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES } from "@/lib/documents/constants";
import { importRichDocument, importSpreadsheet } from "@/lib/documents/office";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import { isRequestSameOrigin } from "@/lib/http/origin";
import {
  exportGoogleDriveFile,
  getGoogleDriveFileMetadata,
  getGoogleSlidesEditorState,
} from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_CORE_SCOPES } from "@/lib/integrations/google/scopes";
import { canManageProjects } from "@/lib/projects/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { googleDriveImportSchema } from "@/lib/validation/google";
import type { Json } from "@/types/database";

const GOOGLE_TYPES = {
  "application/vnd.google-apps.document": {
    extension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    editorKind: "rich_document",
  },
  "application/vnd.google-apps.spreadsheet": {
    extension: "xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    editorKind: "spreadsheet",
  },
  "application/vnd.google-apps.presentation": {
    extension: "pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    editorKind: "presentation",
  },
} as const;

function safeFileName(value: string, extension: string) {
  const base = value
    .replace(/[\\/\u0000-\u001f]/g, " ")
    .replace(/\.(docx|xlsx|pptx)$/i, "")
    .trim()
    .slice(0, 240);
  return `${base || "Google Workspace file"}.${extension}`;
}

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request)) {
    return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  }
  if (!canManageProjects(context.membership.role)) {
    return NextResponse.json(
      { error: "Your workspace role has read-only documents." },
      { status: 403 },
    );
  }
  const parsed = googleDriveImportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Review and confirm the Google file import." },
      { status: 400 },
    );
  }

  try {
    const { accessToken, integration } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_CORE_SCOPES[1]],
    );
    const metadata = await getGoogleDriveFileMetadata(
      accessToken,
      parsed.data.fileId,
    );
    const fileType =
      GOOGLE_TYPES[metadata.mimeType as keyof typeof GOOGLE_TYPES];
    if (!fileType) {
      return NextResponse.json(
        { error: "Choose a Google Doc, Sheet, or Slides presentation." },
        { status: 422 },
      );
    }

    const source = await exportGoogleDriveFile(
      accessToken,
      metadata.id,
      fileType.mimeType,
    );
    if (
      source.length < 2 ||
      source.length > MAX_DOCUMENT_BYTES ||
      source[0] !== 0x50 ||
      source[1] !== 0x4b
    ) {
      return NextResponse.json(
        { error: "The Google file export is invalid or larger than 10 MB." },
        { status: 422 },
      );
    }

    const editorState =
      fileType.editorKind === "rich_document"
        ? await importRichDocument(source)
        : fileType.editorKind === "spreadsheet"
          ? await importSpreadsheet(source)
          : await getGoogleSlidesEditorState(accessToken, metadata.id);
    const validatedState = parseOfficeEditorState(
      fileType.editorKind,
      editorState,
    );
    if (!validatedState.success) {
      return NextResponse.json(
        { error: "The Google file could not be converted for editing." },
        { status: 422 },
      );
    }

    const documentId = randomUUID();
    const fileName = safeFileName(metadata.name, fileType.extension);
    const storagePath = `${context.workspace.id}/${documentId}/source.${fileType.extension}`;
    const admin = getSupabaseAdminClient();
    const { error: documentError } = await admin.from("documents").insert({
      id: documentId,
      workspace_id: context.workspace.id,
      uploaded_by: context.claims.sub,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: fileType.mimeType,
      file_size: source.length,
      visibility: "restricted",
      editor_kind: fileType.editorKind,
      editor_state: validatedState.data as Json,
      last_edited_by: context.claims.sub,
      last_edited_at: new Date().toISOString(),
    });
    if (documentError) {
      return NextResponse.json(
        { error: "The imported document could not be registered." },
        { status: 500 },
      );
    }

    const { error: uploadError } = await admin.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, source, {
        contentType: fileType.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      await admin.from("documents").delete().eq("id", documentId);
      return NextResponse.json(
        { error: "The Google file could not be stored." },
        { status: 502 },
      );
    }

    const syncedAt = new Date().toISOString();
    const { error: linkError } = await admin
      .from("google_document_links")
      .insert({
        workspace_id: context.workspace.id,
        document_id: documentId,
        user_id: context.claims.sub,
        google_file_id: metadata.id,
        google_mime_type: metadata.mimeType,
        google_web_url:
          metadata.webViewLink ??
          `https://drive.google.com/open?id=${encodeURIComponent(metadata.id)}`,
        google_modified_time: metadata.modifiedTime ?? null,
        last_synced_revision: 1,
        last_synced_at: syncedAt,
      });
    if (linkError) {
      await Promise.all([
        admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]),
        admin.from("documents").delete().eq("id", documentId),
      ]);
      return NextResponse.json(
        { error: "The Google file link could not be stored." },
        { status: 500 },
      );
    }

    await Promise.all([
      admin.from("activity_logs").insert({
        workspace_id: context.workspace.id,
        actor_id: context.claims.sub,
        action: "document.google_imported",
        resource_type: "document",
        resource_id: documentId,
        metadata: { mime_type: fileType.mimeType, visibility: "restricted" },
      }),
      admin.from("security_audit_logs").insert({
        workspace_id: context.workspace.id,
        actor_id: context.claims.sub,
        event_type: "google_document.imported",
        provider: "google",
        resource_type: "document",
        resource_id: documentId,
        metadata: {
          integration_id: integration.id,
          google_mime_type: metadata.mimeType,
        },
      }),
    ]);
    return NextResponse.json({ id: documentId }, { status: 201 });
  } catch (error) {
    return googleErrorResponse(error);
  }
}
