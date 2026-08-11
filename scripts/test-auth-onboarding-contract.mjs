import { readFile } from "node:fs/promises";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [redirects, actions, confirm, page, submit, login, code] = await Promise.all([
  readFile(new URL("../src/lib/auth/redirects.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/auth/confirm/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/create-library/onboarding-submit-button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/login/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/library/code.ts", import.meta.url), "utf8"),
]);

assert(redirects.includes('process.env.NEXT_PUBLIC_SITE_URL?.trim()'), "canonical URL helper ignores NEXT_PUBLIC_SITE_URL");
assert(redirects.includes('NODE_ENV === "production"') && redirects.includes('NEXT_PUBLIC_SITE_URL is required in production'), "production can silently fall back to localhost");
assert(redirects.includes('candidate.startsWith("//")') && redirects.includes('candidate.includes("\\\\")'), "external continuation variants are not rejected");
assert(actions.includes('emailRedirectTo: getAuthCallbackUrl(continuation(name, code, person))'), "signup does not use the trusted callback helper");
assert(!actions.includes('password, code') && !actions.includes('password='), "password appears to be included in onboarding continuation URLs");
assert(actions.includes('resumeLibraryOnboardingAction') && actions.includes('signInWithPassword'), "confirmed no-room recovery is absent");
assert(actions.includes('getOperatorContextFromClient') && actions.includes('redirect("/operator")'), "existing operators can continue toward duplicate room creation");
assert(actions.includes('rpc("create_library_room"'), "room creation no longer uses the trusted RPC");
assert(actions.includes('GS_LIBRARY_CODE_TAKEN'), "occupied Library Code is not safely handled");
assert(confirm.includes('exchangeCodeForSession(code!)') && confirm.includes('sanitizeNextPath'), "confirmation route lost code exchange or safe continuation handling");
assert(page.includes('Check your email to verify your address.') && page.includes('personName: query.person'), "confirmation state does not preserve non-sensitive onboarding context");
assert(page.includes('noValidate') && page.includes('Reserved codes and consecutive hyphens'), "server-led Library Code validation is not clearly explained");
assert(submit.includes('useFormStatus') && submit.includes('disabled={isDisabled}') && page.includes('pendingLabel="Creating account…"'), "main pending state does not disable duplicate submission");
assert(page.includes('pendingLabel="Signing in…"'), "recovery pending state is absent");
assert(code.includes('RESERVED_LIBRARY_CODES') && code.includes('!normalized.includes("--")'), "Library Code rules regressed");
assert(login.includes('getOperatorContextFromClient') && login.includes('signOut()'), "normal operator login no longer rejects no-room identities");
console.log("Auth onboarding contract passed: safe production callbacks, confirmation recovery, validation, trusted room creation, and pending form controls.");
