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
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!onboarding) return NextResponse.redirect(toUrl("/create-library"));

  try {
    const supabase = await createSupabaseServerClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, confirmation: true, error: "This verification link could not be completed. Sign in to continue." })));
    } else if (tokenHash && (type === "signup" || type === "email_change")) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, confirmation: true, error: "This verification link could not be completed. Sign in to continue." })));
    } else {
      return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, signIn: true, emailConfirmedReturn: true })));
    }
    const result = await finalizeLibraryOnboarding(supabase, onboarding);
    if (!result.ok) return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, signIn: true, emailConfirmedReturn: true, error: result.message })));
    return NextResponse.redirect(toUrl(`/create-library/success?code=${onboarding.libraryCode}&name=${encodeURIComponent(onboarding.displayName)}`));
  } catch {
    return NextResponse.redirect(toUrl(getLibraryOnboardingContinuation({ ...onboarding, signIn: true, emailConfirmedReturn: true, error: "Email confirmed. Sign in once to finish creating your Library Room." })));
  }
}
