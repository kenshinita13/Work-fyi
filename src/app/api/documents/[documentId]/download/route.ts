import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { DOCUMENT_BUCKET } from "@/lib/documents/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentIdSchema } from "@/lib/validation/document";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const parsed = documentIdSchema.safeParse(await params);
  if (!parsed.success) return errorResponse("Document not found.", 404);

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }

  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", parsed.data.documentId)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return errorResponse("Document not found.", 404);

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, 60, {
      download: document.file_name,
    });
  if (error || !data?.signedUrl) {
    return errorResponse("The document is not available right now.", 502);
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
