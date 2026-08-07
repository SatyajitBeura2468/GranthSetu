import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrustedAppUrl, sanitizeNextPath } from "@/lib/auth/redirects";

const ALLOWED_TYPES = new Set<EmailOtpType>(["invite", "recovery"]);

function errorResponse() {
  return NextResponse.redirect(new URL("/auth/error", getTrustedAppUrl()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(url.searchParams.get("next"), "/update-password");

  if ((tokenHash && (!type || !ALLOWED_TYPES.has(type))) || (!tokenHash && !code)) return errorResponse();

  try {
    const supabase = await createSupabaseServerClient();
    const result = tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (result.error) return errorResponse();
    return NextResponse.redirect(new URL(next, getTrustedAppUrl()));
  } catch {
    return errorResponse();
  }
}
