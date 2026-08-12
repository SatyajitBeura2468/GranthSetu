import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrustedAppUrl, sanitizeNextPath } from "@/lib/auth/redirects";
import { getLibraryOnboardingContinuation } from "@/lib/onboarding/continuation";
import { finalizeLibraryOnboarding, readLibraryOnboardingContinuation } from "@/lib/onboarding/finalize-library";

function toUrl(path: string) { return new URL(path, getTrustedAppUrl()); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next"), "/create-library");
  const onboarding = readLibraryOnboardingContinuation(new URL(next, "http://granthsetu.internal").searchParams);
  const code = url.searchParams.get("code");
  if (!code || !onboarding) return NextResponse.redirect(toUrl("/auth/error"));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(toUrl("/auth/error"));
    const result = await finalizeLibraryOnboarding(supabase, onboarding);
    if (!result.ok) return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, error: result.message })));
    return NextResponse.redirect(toUrl(`/create-library/success?code=${onboarding.libraryCode}&name=${encodeURIComponent(onboarding.displayName)}`));
  } catch {
    return NextResponse.redirect(toUrl("/auth/error"));
  }
}
