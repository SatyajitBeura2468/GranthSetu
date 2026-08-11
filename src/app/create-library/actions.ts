"use server";

import { redirect } from "next/navigation";
import { getOperatorContextFromClient } from "@/lib/auth/authorization";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalizeCurrencyCode, canonicalizeLocale, isSupportedTimeZone } from "@/lib/i18n/library-localization";

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }

function continuation(name: string, code: string, person: string, confirmation = false, error?: string) {
  const query = new URLSearchParams({ name, code, person });
  if (confirmation) query.set("confirmation", "1");
  if (error) query.set("error", error);
  return `/create-library?${query.toString()}`;
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
  if (normalized.includes("already registered") || normalized.includes("already exists")) return "This account may already exist. Confirm it, then use the sign-in option below to finish onboarding.";
  if (normalized.includes("password") || normalized.includes("email")) return "Check your email address and password, then try again.";
  return "We could not create that account right now. Please try again or sign in if the account is already confirmed.";
}

export async function resumeLibraryOnboardingAction(formData: FormData) {
  const name = value(formData, "displayName");
  const code = normalizeLibraryCode(value(formData, "libraryCode"));
  const person = value(formData, "personName");
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || email.length > 320 || !password || password.length > 1024) {
    redirect(continuation(name, code, person, false, "Enter your confirmed account email and password."));
  }

  let signInError = true;
  let isExistingOperator = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    signInError = Boolean(error);
    if (!signInError) isExistingOperator = Boolean(await getOperatorContextFromClient(supabase));
  } catch {
    redirect(continuation(name, code, person, false, "Unable to sign in right now. Please try again."));
  }

  if (signInError) redirect(continuation(name, code, person, false, "Unable to sign in with those credentials. Confirm your email first, then try again."));
  if (isExistingOperator) redirect("/operator");
  redirect(continuation(name, code, person));
}

export async function createLibraryAction(formData: FormData) {
  const name = value(formData, "displayName");
  const code = normalizeLibraryCode(value(formData, "libraryCode"));
  const person = value(formData, "personName");
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const currencyCode = canonicalizeCurrencyCode(value(formData, "currencyCode"));
  const localeCode = canonicalizeLocale(value(formData, "localeCode"));
  const timeZone = value(formData, "timeZone");
  const invalid = validationError(name, code, person);
  if (invalid) redirect(continuation(name, code, person, false, invalid));
  if (!currencyCode || !localeCode || !isSupportedTimeZone(timeZone)) redirect(continuation(name, code, person, false, "Choose a valid currency, locale, and IANA timezone."));

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub) {
    if (await getOperatorContextFromClient(supabase)) redirect("/operator");
  } else {
    const invalidCredentials = signupCredentialError(email, password);
    if (invalidCredentials) redirect(continuation(name, code, person, false, invalidCredentials));
    let signup: Awaited<ReturnType<typeof supabase.auth.signUp>> | null = null;
    try {
      signup = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: person }, emailRedirectTo: getAuthCallbackUrl(continuation(name, code, person)) },
      });
    } catch {
      redirect(continuation(name, code, person, false, "We could not start account creation right now. Please try again."));
    }
    if (!signup || signup.error) redirect(continuation(name, code, person, false, signupErrorMessage(signup?.error?.message)));
    if (!signup.data.session) redirect(continuation(name, code, person, true));
  }

  const { data, error } = await asOperatorRpcClient(supabase).rpc("create_library_room", {
    p_display_name: name,
    p_public_code: code,
    p_creator_display_name: person,
    p_currency_code: currencyCode,
    p_locale_code: localeCode,
    p_time_zone: timeZone,
  });
  if (error || !data) {
    redirect(continuation(name, code, person, false, error?.message.includes("GS_LIBRARY_CODE_TAKEN")
      ? "That Library Code is already in use."
      : error?.message.includes("GS_PROFILE_INACTIVE")
        ? "This account is globally inactive. A Library Room cannot reactivate it."
        : "The Library Room could not be created."));
  }
  redirect(`/create-library/success?code=${code}&name=${encodeURIComponent(name)}`);
}
