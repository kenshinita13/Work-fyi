import { NextResponse } from "next/server";

import { GoogleIntegrationError } from "./client";

export function googleErrorResponse(error: unknown) {
  if (error instanceof GoogleIntegrationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: "Google Workspace is unavailable right now." },
    { status: 502 },
  );
}
