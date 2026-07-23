import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { canEditDocument } from "@/lib/documents/permissions";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import type {
  PresentationState,
  RichDocumentState,
  SpreadsheetState,
} from "@/lib/documents/office-types";
import { isRequestSameOrigin } from "@/lib/http/origin";
import {
  createGoogleDoc,
  createGoogleSheet,
  createGoogleSlides,
  getGoogleDriveFileMetadata,
  updateGoogleDoc,
  updateGoogleSheet,
  updateGoogleSlides,
} from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_CORE_SCOPES } from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googlePublishSchema } from "@/lib/validation/google";

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request))
    return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  const parsed = googlePublishSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review and confirm the Google publish action." },
      { status: 400 },
    );

  const supabase = await createSupabaseServerClient();
  const [{ data: document }, { data: ownShare }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id,file_name,editor_kind,editor_state,content_revision,uploaded_by,visibility",
      )
      .eq("id", parsed.data.documentId)
      .eq("workspace_id", context.workspace.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("document_shares")
      .select("permission")
      .eq("document_id", parsed.data.documentId)
      .eq("user_id", context.claims.sub)
      .maybeSingle(),
  ]);
  if (!document)
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (
    !canEditDocument(
      context.membership.role,
      context.claims.sub,
      { uploadedBy: document.uploaded_by, visibility: document.visibility },
      ownShare?.permission ?? null,
    )
  ) {
    return NextResponse.json(
      { error: "You have read-only access to this document." },
      { status: 403 },
    );
  }
  if (document.content_revision !== parsed.data.expectedRevision) {
    return NextResponse.json(
      { error: "This document changed. Refresh before publishing it." },
      { status: 409 },
    );
  }
  const editorKind =
    parsed.data.target === "docs"
      ? "rich_document"
      : parsed.data.target === "sheets"
        ? "spreadsheet"
        : "presentation";
  if (document.editor_kind !== editorKind) {
    return NextResponse.json(
      {
        error:
          "This file type cannot be published to the selected Google editor.",
      },
      { status: 422 },
    );
  }

  const officeState = parseOfficeEditorState(editorKind, document.editor_state);
  if (!officeState.success)
    return NextResponse.json(
      { error: "The local document content could not be read." },
      { status: 422 },
    );
  try {
    const { accessToken, integration } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_CORE_SCOPES[1]],
    );
    const admin = getSupabaseAdminClient();
    const { data: existing } = await admin
      .from("google_document_links")
      .select("*")
      .eq("workspace_id", context.workspace.id)
      .eq("document_id", document.id)
      .eq("user_id", context.claims.sub)
      .maybeSingle();
    let published: { id: string; mimeType: string; webViewLink: string };
    if (parsed.data.target === "docs") {
      const state = officeState.data as RichDocumentState;
      published = existing
        ? await updateGoogleDoc(accessToken, {
            fileId: existing.google_file_id,
            state,
          })
        : await createGoogleDoc(accessToken, {
            title: document.file_name,
            state,
          });
    } else if (parsed.data.target === "sheets") {
      const state = officeState.data as SpreadsheetState;
      published = existing
        ? await updateGoogleSheet(accessToken, {
            fileId: existing.google_file_id,
            state,
          })
        : await createGoogleSheet(accessToken, {
            title: document.file_name,
            state,
          });
    } else {
      const state = officeState.data as PresentationState;
      published = existing
        ? await updateGoogleSlides(accessToken, {
            fileId: existing.google_file_id,
            state,
          })
        : await createGoogleSlides(accessToken, {
            title: document.file_name,
            state,
          });
    }
    const metadata = await getGoogleDriveFileMetadata(
      accessToken,
      published.id,
    );
    const syncedAt = new Date().toISOString();
    const { error: linkError } = await admin
      .from("google_document_links")
      .upsert(
        {
          workspace_id: context.workspace.id,
          document_id: document.id,
          user_id: context.claims.sub,
          google_file_id: published.id,
          google_mime_type: published.mimeType,
          google_web_url: metadata.webViewLink ?? published.webViewLink,
          google_modified_time: metadata.modifiedTime ?? null,
          last_synced_revision: document.content_revision,
          last_synced_at: syncedAt,
        },
        { onConflict: "workspace_id,document_id,user_id" },
      );
    if (linkError) throw new Error("google_link_save_failed");
    await admin.from("security_audit_logs").insert({
      workspace_id: context.workspace.id,
      actor_id: context.claims.sub,
      event_type: existing
        ? "google_document.synced"
        : "google_document.published",
      provider: "google",
      resource_type: "document",
      resource_id: document.id,
      metadata: {
        integration_id: integration.id,
        google_mime_type: published.mimeType,
      },
    });
    return NextResponse.json(
      {
        url: metadata.webViewLink ?? published.webViewLink,
        syncedAt,
        created: !existing,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return googleErrorResponse(error);
  }
}
