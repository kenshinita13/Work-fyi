import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { listGoogleCalendarEvents } from "@/lib/integrations/google/api";
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
    const { accessToken } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_CORE_SCOPES[0]],
    );
    return NextResponse.json({
      events: await listGoogleCalendarEvents(accessToken),
    });
  } catch (error) {
    return googleErrorResponse(error);
  }
}
