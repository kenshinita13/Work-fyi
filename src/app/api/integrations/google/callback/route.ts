import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { getGoogleEnv, isGoogleConfigured } from "@/lib/env/server";
import {
  encryptedGoogleTokens,
  exchangeGoogleAuthorizationCode,
  getGoogleUserInfo,
} from "@/lib/integrations/google/client";
import { verifyGoogleOAuthState } from "@/lib/integrations/google/oauth-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function redirectWithStatus(request: NextRequest, status: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${status}`, request.url),
  );
  response.cookies.delete("work_fyi_google_oauth");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured())
    return redirectWithStatus(request, "error=not_configured");
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return redirectWithStatus(request, "error=unauthorized");
  }

  const env = getGoogleEnv();
  const state = verifyGoogleOAuthState(
    request.cookies.get("work_fyi_google_oauth")?.value,
    request.nextUrl.searchParams.get("state"),
    env.encryptionKey,
  );
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !code || request.nextUrl.searchParams.has("error")) {
    return redirectWithStatus(request, "error=oauth_rejected");
  }

  try {
    const tokens = await exchangeGoogleAuthorizationCode(code);
    const account = await getGoogleUserInfo(tokens.access_token);
    const admin = getSupabaseAdminClient();
    const { data: existing } = await admin
      .from("user_integrations")
      .select("id, refresh_token_ciphertext, scopes")
      .eq("workspace_id", context.workspace.id)
      .eq("user_id", context.claims.sub)
      .eq("provider", "google")
      .maybeSingle();
    const encrypted = encryptedGoogleTokens({
      workspaceId: context.workspace.id,
      userId: context.claims.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
    const grantedScopes = tokens.scope
      ? tokens.scope.split(" ").filter(Boolean)
      : [];
    const scopes = Array.from(
      new Set([...(existing?.scopes ?? []), ...grantedScopes]),
    );
    const row = {
      workspace_id: context.workspace.id,
      user_id: context.claims.sub,
      provider: "google" as const,
      provider_account_id: account.sub,
      account_email: account.email,
      display_name: account.name ?? null,
      access_token_ciphertext: encrypted.accessTokenCiphertext,
      refresh_token_ciphertext:
        encrypted.refreshTokenCiphertext ??
        existing?.refresh_token_ciphertext ??
        null,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
      scopes,
      status: "active" as const,
      last_error_code: null,
      revoked_at: null,
      connected_at: new Date().toISOString(),
    };
    const { data: saved, error } = await admin
      .from("user_integrations")
      .upsert(row, { onConflict: "workspace_id,user_id,provider" })
      .select("id")
      .single();
    if (error || !saved) throw new Error("integration_save_failed");

    await admin.from("security_audit_logs").insert({
      workspace_id: context.workspace.id,
      actor_id: context.claims.sub,
      event_type: existing
        ? "integration.permissions_updated"
        : "integration.connected",
      provider: "google",
      resource_type: "integration",
      resource_id: saved.id,
      metadata: { capability: state.capability, scope_count: scopes.length },
    });
    return redirectWithStatus(request, `connected=${state.capability}`);
  } catch {
    return redirectWithStatus(request, "error=oauth_failed");
  }
}
