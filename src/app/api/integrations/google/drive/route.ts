import { NextResponse, type NextRequest } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/session";
import { listGoogleDriveFiles } from "@/lib/integrations/google/api";
import { getGoogleAccess } from "@/lib/integrations/google/client";
import { googleErrorResponse } from "@/lib/integrations/google/errors";
import { GOOGLE_CORE_SCOPES } from "@/lib/integrations/google/scopes";
import { googleDriveQuerySchema } from "@/lib/validation/google";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  }
  const parsed = googleDriveQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    pageToken: request.nextUrl.searchParams.get("pageToken") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid Drive search." },
      { status: 400 },
    );
  try {
    const { accessToken } = await getGoogleAccess(
      context.workspace.id,
      context.claims.sub,
      [GOOGLE_CORE_SCOPES[1]],
    );
    return NextResponse.json(
      await listGoogleDriveFiles(accessToken, parsed.data),
    );
  } catch (error) {
    return googleErrorResponse(error);
  }
}
