import type { NextRequest } from "next/server";

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function isRequestSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProtocol = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );
  const protocol = forwardedProtocol ?? request.nextUrl.protocol.slice(0, -1);
  const requestOrigins = new Set([request.nextUrl.origin]);

  if (host && (protocol === "http" || protocol === "https")) {
    requestOrigins.add(`${protocol}://${host}`);
  }

  return requestOrigins.has(parsedOrigin.origin);
}
