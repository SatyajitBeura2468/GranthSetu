import { readFile } from "node:fs/promises";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [redirects, actions, confirm, libraryConfirm, finalizer, page, submit, login, code] = await Promise.all([
  readFile(new URL("../src/lib/auth/redirects.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/auth/confirm/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/auth/confirm-library/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/onboarding/finalize-library.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/onboarding-submit-button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/login/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/library/code.ts", import.meta.url), "utf8"),
]);

assert(redirects.includes('process.env.NEXT_PUBLIC_SITE_URL?.trim()'), "canonical URL helper ignores NEXT_PUBLIC_SITE_URL");
assert(redirects.includes('NODE_ENV === "production"') && redirects.includes('NEXT_PUBLIC_SITE_URL is required in production'), "production can silently fall back to localhost");
assert(redirects.includes('process.env.VERCEL_ENV === "preview"') && redirects.includes('VERCEL_BRANCH_URL') && redirects.includes('VERCEL_URL'), "Preview callbacks cannot use Vercel's trusted deployment origin");
assert(redirects.includes('hostname === "localhost"') && redirects.includes('hostname === "127.0.0.1"') && redirects.includes('hostname === "::1"'), "production callback permits a localhost origin");
assert(!redirects.includes('x-forwarded-host') && !redirects.includes('headers()'), "callback origin can be derived from request headers");
assert(redirects.includes('candidate.startsWith("//")') && redirects.includes('candidate.includes("\\\\")'), "external continuation variants are not rejected");
assert(actions.includes('getLibraryOnboardingCallbackUrl') && actions.includes('emailRedirectTo: getLibraryOnboardingCallbackUrl'), "signup does not use the dedicated trusted library callback");
assert(actions.includes('getLibraryOnboardingContinuation'), "signup continuation is not centrally controlled");
assert(!actions.includes('password='), "password appears to be included in onboarding continuation URLs");
assert(actions.includes('resumeLibraryOnboardingAction') && actions.includes('signInWithPassword'), "confirmed no-room recovery is absent");
assert(actions.includes('resendLibraryVerificationAction') && actions.includes('resend({ type: "signup"'), "safe verification resend is absent");
assert(actions.includes('getOperatorContextFromClient') && actions.includes('redirect("/operator")'), "existing operators can continue toward duplicate room creation");
assert(finalizer.includes('rpc("create_library_room"') && finalizer.includes('getClaims'), "room creation no longer uses the authenticated trusted RPC");
assert(finalizer.includes('GS_LIBRARY_CODE_TAKEN'), "occupied Library Code is not safely handled");
assert(confirm.includes('exchangeCodeForSession(code!)') && confirm.includes('sanitizeNextPath'), "generic confirmation route lost recovery/invite handling");
assert(libraryConfirm.includes('exchangeCodeForSession(code)') && libraryConfirm.includes('finalizeLibraryOnboarding') && libraryConfirm.includes('readLibraryOnboardingContinuation'), "library confirmation does not finalize the trusted onboarding continuation");
assert(page.includes('Verify your email') && !page.includes('Supabase accepted the signup request') && page.includes('personName: query.person') && page.includes('currencyCode: query.currencyCode') && page.includes('localeCode: query.localeCode') && page.includes('timeZone: query.timeZone'), "verification state does not preserve a clean localization onboarding context");
assert(page.includes('noValidate') && page.includes('Reserved codes and consecutive hyphens'), "server-led Library Code validation is not clearly explained");
assert(submit.includes('useFormStatus') && submit.includes('disabled={isDisabled}') && page.includes('pendingLabel="Creating account…"'), "main pending state does not disable duplicate submission");
assert(page.includes('pendingLabel="Signing in…"') && page.includes('pendingLabel="Sending verification email…"'), "recovery or resend pending state is absent");
assert(code.includes('RESERVED_LIBRARY_CODES') && code.includes('!normalized.includes("--")'), "Library Code rules regressed");
assert(login.includes('getOperatorContextFromClient') && login.includes('signOut()'), "normal operator login no longer rejects no-room identities");
console.log("Auth onboarding contract passed: safe confirmation finalization, verification recovery, validation, trusted room creation, and pending form controls.");
