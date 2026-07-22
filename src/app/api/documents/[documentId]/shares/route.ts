import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageDocumentSharing } from "@/lib/documents/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  documentIdSchema,
  documentSharingSchema,
} from "@/lib/validation/document";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("Request rejected.", 403);

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
    return errorResponse("The sharing request is invalid.", 400);
  }

  const parsedBody = documentSharingSchema.safeParse(payload);
  if (!parsedBody.success) {
    return errorResponse(
      parsedBody.error.issues[0]?.message ?? "The sharing request is invalid.",
      400,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, file_name, uploaded_by")
    .eq("id", parsedId.data.documentId)
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
    return errorResponse("You cannot change sharing for this document.", 403);
  }

  const requestedUserIds = parsedBody.data.shares.map((share) => share.userId);
  const { data: targetMemberships } = requestedUserIds.length
    ? await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", context.workspace.id)
        .in("user_id", requestedUserIds)
    : { data: [] };
  const roles = new Map(
    targetMemberships?.map((membership) => [
      membership.user_id,
      membership.role,
    ]) ?? [],
  );

  for (const share of parsedBody.data.shares) {
    const targetRole = roles.get(share.userId);
    if (!targetRole || share.userId === context.claims.sub) {
      return errorResponse(
        "Choose valid workspace members to share with.",
        400,
      );
    }
    if (share.permission === "editor" && targetRole === "viewer") {
      return errorResponse(
        "Viewer accounts cannot receive document editing permission.",
        400,
      );
    }
  }

  const admin = getSupabaseAdminClient();
  const rpcShares = parsedBody.data.shares.map((share) => ({
    user_id: share.userId,
    permission: share.permission,
  }));
  const { data: shareCount, error: sharingError } = await admin.rpc(
    "set_document_sharing",
    {
      input_document_id: document.id,
      input_workspace_id: context.workspace.id,
      input_actor_id: context.claims.sub,
      input_visibility: parsedBody.data.visibility,
      input_shares: rpcShares,
    },
  );

  if (sharingError) {
    console.error("Document sharing update failed", {
      code: sharingError.code,
      message: sharingError.message,
    });
    return errorResponse("Document sharing could not be updated.", 500);
  }

  await admin.from("activity_logs").insert({
    workspace_id: context.workspace.id,
    actor_id: context.claims.sub,
    action: "document.sharing_updated",
    resource_type: "document",
    resource_id: document.id,
    metadata: {
      file_name: document.file_name,
      visibility: parsedBody.data.visibility,
      share_count: shareCount ?? 0,
    },
  });

  return NextResponse.json({
    visibility: parsedBody.data.visibility,
    shareCount: shareCount ?? 0,
  });
}
