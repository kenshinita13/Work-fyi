import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { isRequestSameOrigin } from "@/lib/http/origin";
import { createGoogleGmailDraft } from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_GMAIL_SCOPES } from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { googleGmailDraftSchema } from "@/lib/validation/google";

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request))
    return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  const parsed = googleGmailDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review and confirm the email draft first." },
      { status: 400 },
    );
  try {
    const { accessToken, integration } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_GMAIL_SCOPES[1]],
    );
    const draft = await createGoogleGmailDraft(accessToken, parsed.data);
    await getSupabaseAdminClient()
      .from("security_audit_logs")
      .insert({
        workspace_id: context.workspace.id,
        actor_id: context.claims.sub,
        event_type: "gmail.draft_created",
        provider: "google",
        resource_type: "gmail_draft",
        resource_id: draft.id,
        metadata: {
          integration_id: integration.id,
          recipient_domain: parsed.data.to.split("@")[1],
        },
      });
    return NextResponse.json({ draftId: draft.id }, { status: 201 });
  } catch (error) {
    return googleErrorResponse(error);
  }
}
