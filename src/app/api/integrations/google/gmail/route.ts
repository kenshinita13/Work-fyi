import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { listGoogleGmailMessages } from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_GMAIL_SCOPES } from "@/lib/integrations/google/scopes";
import { googleGmailQuerySchema } from "@/lib/validation/google";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  }
  const parsed = googleGmailQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    pageToken: request.nextUrl.searchParams.get("pageToken") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid Gmail search." },
      { status: 400 },
    );
  try {
    const { accessToken } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_GMAIL_SCOPES[0]],
    );
    return NextResponse.json(
      await listGoogleGmailMessages(accessToken, parsed.data),
    );
  } catch (error) {
    return googleErrorResponse(error);
  }
}
