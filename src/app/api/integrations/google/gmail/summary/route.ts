import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { getAiEnv } from "@/lib/env/server";
import { isRequestSameOrigin } from "@/lib/http/origin";
import { getGoogleGmailMessage } from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { generateGoogleEmailSummary } from "@/lib/integrations/google/email-summary";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_GMAIL_SCOPES } from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { googleEmailSummarySchema } from "@/lib/validation/google";

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request))
    return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  const parsed = googleEmailSummarySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Select between 1 and 10 emails." },
      { status: 400 },
    );

  const admin = getSupabaseAdminClient();
  let model: string;
  try {
    model = getAiEnv().aiModel.replace(/^openai\//, "");
  } catch {
    return NextResponse.json(
      { error: "AI summaries have not been configured yet." },
      { status: 503 },
    );
  }
  const { data: usageId, error: usageError } = await admin.rpc(
    "reserve_google_email_summary_usage",
    {
      input_workspace_id: context.workspace.id,
      input_user_id: context.claims.sub,
      input_model: model,
    },
  );
  if (usageError || !usageId) {
    const rateLimited =
      usageError?.message.includes("AI_RATE_LIMIT") ||
      usageError?.message.includes("AI_QUOTA_EXCEEDED");
    return NextResponse.json(
      {
        error: rateLimited
          ? "Email summary limit reached. Try again later."
          : "AI summaries are unavailable.",
      },
      { status: rateLimited ? 429 : 503 },
    );
  }

  try {
    const { accessToken, integration } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_GMAIL_SCOPES[0]],
    );
    const messages = await Promise.all(
      parsed.data.messageIds.map((id) =>
        getGoogleGmailMessage(accessToken, id),
      ),
    );
    const result = await generateGoogleEmailSummary(messages);
    await Promise.all([
      admin
        .from("ai_usage")
        .update({
          model: result.modelId,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          status: "completed",
        })
        .eq("id", usageId),
      admin.from("security_audit_logs").insert({
        workspace_id: context.workspace.id,
        actor_id: context.claims.sub,
        event_type: "gmail.messages_summarized",
        provider: "google",
        resource_type: "gmail_message_selection",
        metadata: {
          integration_id: integration.id,
          message_count: messages.length,
        },
      }),
    ]);
    return NextResponse.json(result.summary);
  } catch (error) {
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", usageId);
    return googleErrorResponse(error);
  }
}
