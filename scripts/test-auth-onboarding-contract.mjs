import { readFile } from "node:fs/promises";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [redirects, actions, confirm, page, login] = await Promise.all([
  readFile(new URL("../src/lib/auth/redirects.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/auth/confirm/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/login/actions.ts", import.meta.url), "utf8"),
]);

assert(redirects.includes('process.env.NEXT_PUBLIC_SITE_URL?.trim()'), "canonical URL helper ignores NEXT_PUBLIC_SITE_URL");
assert(redirects.includes('`${getTrustedAppUrl()}/auth/confirm?next=${encodeURIComponent(safeNext)}`'), "auth callback URL is not derived from the trusted canonical origin");
assert(!redirects.includes('request.headers') && !redirects.includes('headers()'), "auth callback URL trusts a request host header");
assert(actions.includes('emailRedirectTo: getAuthCallbackUrl('), "signup does not use the canonical auth callback helper");
assert(actions.includes('resumeLibraryOnboardingAction') && actions.includes('signInWithPassword'), "confirmed no-room accounts have no onboarding recovery sign-in");
assert(actions.includes('getOperatorContextFromClient') && actions.includes('redirect("/operator")'), "existing operators are not diverted away from duplicate onboarding");
assert(confirm.includes('exchangeCodeForSession(code!)') && confirm.includes('sanitizeNextPath'), "signup auth-code callback or safe continuation handling regressed");
assert(page.includes('Already confirmed? Sign in to finish creating your Library Room.') && page.includes('resumeLibraryOnboardingAction'), "onboarding recovery control is absent");
assert(login.includes('getOperatorContextFromClient') && login.includes('signOut()'), "normal operator login no longer rejects no-room identities");
console.log("Auth onboarding contract passed: canonical callback origin, safe continuation, confirmed no-room recovery, and strict operator login.");
