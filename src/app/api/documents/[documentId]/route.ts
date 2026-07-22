import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { DOCUMENT_BUCKET } from "@/lib/documents/constants";
import { canManageProjects } from "@/lib/projects/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentIdSchema } from "@/lib/validation/document";

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("Request rejected.", 403);

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
    .select("id, storage_path, file_name")
    .eq("id", parsed.data.documentId)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return errorResponse("Document not found.", 404);

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
