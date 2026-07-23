import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import {
  decryptIntegrationRefreshToken,
  revokeGoogleToken,
} from "@/lib/integrations/google/client";
import { isRequestSameOrigin } from "@/lib/http/origin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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
  const admin = getSupabaseAdminClient();
  const { data: integration } = await admin
    .from("user_integrations")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", context.claims.sub)
    .eq("provider", "google")
    .maybeSingle();
  if (!integration) return NextResponse.json({ disconnected: true });

  let providerRevoked = false;
  try {
    const refreshToken = decryptIntegrationRefreshToken(integration);
    if (refreshToken) providerRevoked = await revokeGoogleToken(refreshToken);
  } catch {
    providerRevoked = false;
  }

  await Promise.all([
    admin
      .from("google_document_links")
      .delete()
      .eq("workspace_id", context.workspace.id)
      .eq("user_id", context.claims.sub),
    admin.from("user_integrations").delete().eq("id", integration.id),
    admin.from("security_audit_logs").insert({
      workspace_id: context.workspace.id,
      actor_id: context.claims.sub,
      event_type: "integration.revoked",
      provider: "google",
      resource_type: "integration",
      resource_id: integration.id,
      metadata: { provider_revoked: providerRevoked },
    }),
  ]);
  return NextResponse.json({ disconnected: true });
}
