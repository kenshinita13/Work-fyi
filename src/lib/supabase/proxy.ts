import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env/public";

export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isProtectedRoute = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/documents",
    "/ai",
    "/team",
  ].some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`),
  );

  if (!data?.claims?.sub && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
