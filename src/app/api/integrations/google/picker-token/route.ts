import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_CORE_SCOPES } from "@/lib/integrations/google/scopes";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  }
  try {
    const { accessToken, integration } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_CORE_SCOPES[1]],
    );
    return NextResponse.json(
      { accessToken, expiresAt: integration.token_expires_at },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return googleErrorResponse(error);
  }
}
