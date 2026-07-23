import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { getGoogleEnv, isGoogleConfigured } from "@/lib/env/server";
import { createGoogleOAuthState } from "@/lib/integrations/google/oauth-state";
import { scopesForCapability } from "@/lib/integrations/google/scopes";
import { googleCapabilityQuerySchema } from "@/lib/validation/google";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return NextResponse.redirect(
      new URL("/auth/login?next=/integrations", request.url),
    );
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/integrations?error=not_configured", request.url),
    );
  }

  const parsed = googleCapabilityQuerySchema.safeParse({
    capability: request.nextUrl.searchParams.get("capability") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_capability", request.url),
    );
  }

  const env = getGoogleEnv();
  const state = createGoogleOAuthState(
    parsed.data.capability,
    env.encryptionKey,
  );
  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    scope: scopesForCapability(parsed.data.capability).join(" "),
    state: state.state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("work_fyi_google_oauth", state.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.redirectUri.startsWith("https://"),
    path: "/api/integrations/google/callback",
    maxAge: 10 * 60,
  });
  return response;
}
