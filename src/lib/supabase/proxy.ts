import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import type { Database } from "@/types/database";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function updateSession(request: NextRequest) {
  const publicEnv = getOptionalPublicSupabaseEnv();
  const pathname = request.nextUrl.pathname;
  const protectedRoute = pathname === "/operator" || pathname.startsWith("/operator/");

  if (!publicEnv) {
    if (!protectedRoute) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(sanitizeNextPath(pathname))}`;
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient<Database>(publicEnv.url, publicEnv.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  let hasVerifiedClaims = false;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    hasVerifiedClaims = Boolean(claims);
  } catch {
    hasVerifiedClaims = false;
  }

  if (!hasVerifiedClaims && protectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(sanitizeNextPath(pathname))}`;
    return copyCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  return supabaseResponse;
}
