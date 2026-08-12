"use server";

import { redirect } from "next/navigation";
import { getOperatorContextFromClient } from "@/lib/auth/authorization";
import { getLibraryOnboardingCallbackUrl } from "@/lib/auth/redirects";
import { canonicalizeCurrencyCode, canonicalizeLocale, isSupportedTimeZone } from "@/lib/i18n/library-localization";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";
import { getLibraryOnboardingContinuation } from "@/lib/onboarding/continuation";
import { finalizeLibraryOnboarding } from "@/lib/onboarding/finalize-library";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
function continuation(name: string, code: string, person: string, currencyCode: string, localeCode: string, timeZone: string, confirmation = false, error?: string) {
  return getLibraryOnboardingContinuation({ displayName: name, libraryCode: code, personName: person, currencyCode, localeCode, timeZone, confirmation, error });
}
function validationError(name: string, code: string, person: string) {
  if (person.length < 2 || person.length > 120) return "Enter a display name between 2 and 120 characters.";
  if (name.length < 3 || name.length > 160) return "Enter an institution or library name between 3 and 160 characters.";
  if (!validLibraryCode(code)) return "Use a valid Library Code: 5–16 letters or numbers, with internal hyphens only; reserved codes and consecutive hyphens are unavailable.";
  return null;
}
function signupCredentialError(email: string, password: string) {
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (password.length < 12 || password.length > 1024) return "Use a password between 12 and 1024 characters.";
  return null;
}
function signupErrorMessage(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("rate limit") || normalized.includes("email rate")) return "Too many account or email requests. Please wait a little before trying again.";
  if (normalized.includes("already registered") || normalized.includes("already exists")) return "We could not start another verification email. If this address belongs to a GranthSetu account, sign in to continue.";
  if (normalized.includes("password") || normalized.includes("email")) return "Check your email address and password, then try again.";
  return "We could not create that account right now. Please try again or sign in if the account is already confirmed.";
}

function asOnboarding(name: string, code: string, person: string, currencyCode: string, localeCode: string, timeZone: string) {
  return { displayName: name, libraryCode: code, personName: person, currencyCode, localeCode, timeZone };
}

function redirectFinalization(result: Awaited<ReturnType<typeof finalizeLibraryOnboarding>>, name: string, code: string, person: string, currencyCode: string, localeCode: string, timeZone: string): never {
  if (!result.ok) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, result.message));
  redirect(`/create-library/success?code=${code}&name=${encodeURIComponent(name)}`);
}

export async function resumeLibraryOnboardingAction(formData: FormData) {
  const name = value(formData, "displayName"); const code = normalizeLibraryCode(value(formData, "libraryCode")); const person = value(formData, "personName");
  const email = value(formData, "email").toLowerCase(); const password = String(formData.get("password") ?? "");
  const currencyCode = canonicalizeCurrencyCode(value(formData, "currencyCode")) ?? "INR";
  const localeCode = canonicalizeLocale(value(formData, "localeCode")) ?? "en-IN";
  const timeZone = value(formData, "timeZone") || "Asia/Kolkata";
  if (!email || email.length > 320 || !password || password.length > 1024) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, "Enter your confirmed account email and password."));
  const supabase = await createSupabaseServerClient();
  let signInError = true; let isExistingOperator = false;
  try { const { error } = await supabase.auth.signInWithPassword({ email, password }); signInError = Boolean(error); if (!signInError) isExistingOperator = Boolean(await getOperatorContextFromClient(supabase)); }
  catch { redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, "Unable to sign in right now. Please try again.")); }
  if (signInError) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, "Unable to sign in with that email and password. Check your credentials or reset your password."));
  if (isExistingOperator) redirect("/operator");
  const result = await finalizeLibraryOnboarding(supabase, asOnboarding(name, code, person, currencyCode, localeCode, timeZone));
  redirectFinalization(result, name, code, person, currencyCode, localeCode, timeZone);
}

export async function resendLibraryVerificationAction(formData: FormData) {
  const name = value(formData, "displayName"); const code = normalizeLibraryCode(value(formData, "libraryCode")); const person = value(formData, "personName");
  const email = value(formData, "email").toLowerCase(); const currencyCode = canonicalizeCurrencyCode(value(formData, "currencyCode")) ?? "INR"; const localeCode = canonicalizeLocale(value(formData, "localeCode")) ?? "en-IN"; const timeZone = value(formData, "timeZone") || "Asia/Kolkata";
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, true, "Enter a valid email address."));
  let resendError: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: getLibraryOnboardingCallbackUrl(continuation(name, code, person, currencyCode, localeCode, timeZone)) } });
    resendError = error ? signupErrorMessage(error.message) : undefined;
  } catch {
    resendError = "We could not send another verification email yet. Please wait a moment and try again.";
  }
  if (resendError) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, true, resendError));
  redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, true));
}

export async function createLibraryAction(formData: FormData) {
  const name = value(formData, "displayName"); const code = normalizeLibraryCode(value(formData, "libraryCode")); const person = value(formData, "personName");
  const email = value(formData, "email").toLowerCase(); const password = String(formData.get("password") ?? "");
  const currencyCode = canonicalizeCurrencyCode(value(formData, "currencyCode")); const localeCode = canonicalizeLocale(value(formData, "localeCode")); const timeZone = value(formData, "timeZone");
  const invalid = validationError(name, code, person);
  if (invalid) redirect(continuation(name, code, person, value(formData, "currencyCode") || "INR", value(formData, "localeCode") || "en-IN", timeZone || "Asia/Kolkata", false, invalid));
  if (!currencyCode || !localeCode || !isSupportedTimeZone(timeZone)) redirect(continuation(name, code, person, value(formData, "currencyCode") || "INR", value(formData, "localeCode") || "en-IN", timeZone || "Asia/Kolkata", false, "Choose a valid currency, locale, and IANA timezone."));
  const supabase = await createSupabaseServerClient(); const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub) { if (await getOperatorContextFromClient(supabase)) redirect("/operator"); }
  else {
    const invalidCredentials = signupCredentialError(email, password);
    if (invalidCredentials) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, invalidCredentials));
    let signup: Awaited<ReturnType<typeof supabase.auth.signUp>> | null = null;
    try { signup = await supabase.auth.signUp({ email, password, options: { data: { display_name: person }, emailRedirectTo: getLibraryOnboardingCallbackUrl(continuation(name, code, person, currencyCode, localeCode, timeZone)) } }); }
    catch { redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, "We could not start account creation right now. Please try again.")); }
    if (!signup || signup.error) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, false, signupErrorMessage(signup?.error?.message)));
    if (!signup.data.session) redirect(continuation(name, code, person, currencyCode, localeCode, timeZone, true));
  }
  const result = await finalizeLibraryOnboarding(supabase, asOnboarding(name, code, person, currencyCode, localeCode, timeZone));
  redirectFinalization(result, name, code, person, currencyCode, localeCode, timeZone);
}
