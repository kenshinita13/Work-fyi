export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
