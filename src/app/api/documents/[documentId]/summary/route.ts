import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import {
  DOCUMENT_BUCKET,
  type DocumentMimeType,
} from "@/lib/documents/constants";
import { generateDocumentSummary } from "@/lib/documents/summary";
import { extractDocumentText } from "@/lib/documents/text";
import { getAiEnv } from "@/lib/env/server";
import { canManageProjects } from "@/lib/projects/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentIdSchema } from "@/lib/validation/document";

export const runtime = "nodejs";

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

export async function POST(
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

  let aiModel: string;
  try {
    aiModel = getAiEnv().aiModel.replace(/^openai\//, "");
  } catch {
    return errorResponse("AI summaries have not been configured yet.", 503);
  }

  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, file_name, storage_path, mime_type")
    .eq("id", parsed.data.documentId)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return errorResponse("Document not found.", 404);

  const admin = getSupabaseAdminClient();
  const { data: usageId, error: usageError } = await admin.rpc(
    "reserve_document_summary_usage",
    {
      input_workspace_id: context.workspace.id,
      input_user_id: context.claims.sub,
      input_model: aiModel,
    },
  );
  if (usageError || !usageId) {
    if (usageError?.message.includes("AI_RATE_LIMIT")) {
      return errorResponse(
        "Too many summaries were requested. Try again shortly.",
        429,
      );
    }
    if (usageError?.message.includes("AI_QUOTA_EXCEEDED")) {
      return errorResponse(
        "This workspace has reached today's summary quota.",
        429,
      );
    }
    return errorResponse("AI summaries are not available right now.", 503);
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .download(document.storage_path);
  if (downloadError || !file) {
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", usageId);
    return errorResponse("The document file could not be read.", 502);
  }

  let text: string;
  try {
    text = await extractDocumentText(
      await file.arrayBuffer(),
      document.mime_type as DocumentMimeType,
    );
  } catch {
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", usageId);
    return errorResponse(
      "We could not extract enough readable text from this document.",
      422,
    );
  }

  try {
    const generated = await generateDocumentSummary({
      fileName: document.file_name,
      mimeType: document.mime_type,
      text,
    });
    const generatedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("documents")
      .update({
        summary_draft: generated.summary,
        summary_model: generated.modelId,
        summary_generated_at: generatedAt,
      })
      .eq("id", document.id)
      .eq("workspace_id", context.workspace.id)
      .is("deleted_at", null);
    if (updateError) throw new Error("summary_update_failed");

    await Promise.all([
      admin
        .from("ai_usage")
        .update({
          model: generated.modelId,
          input_tokens: generated.inputTokens,
          output_tokens: generated.outputTokens,
          status: "completed",
        })
        .eq("id", usageId),
      admin.from("activity_logs").insert({
        workspace_id: context.workspace.id,
        actor_id: context.claims.sub,
        action: "document.summary_generated",
        resource_type: "document",
        resource_id: document.id,
        metadata: { model: generated.modelId },
      }),
    ]);

    return NextResponse.json({
      summary: generated.summary,
      generatedAt,
    });
  } catch {
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", usageId);
    return errorResponse(
      "We could not generate a valid summary draft. Please try again.",
      502,
    );
  }
}
