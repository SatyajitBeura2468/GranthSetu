import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { canonicalizeCurrencyCode, canonicalizeLocale, isSupportedTimeZone } from "@/lib/i18n/library-localization";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";
import { getOperatorContextFromClient } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

export type LibraryOnboardingData = {
  displayName: string;
  libraryCode: string;
  personName: string;
  currencyCode: string;
  localeCode: string;
  timeZone: string;
};

export type LibraryFinalization =
  | { ok: true }
  | { ok: false; message: string };

/** Re-validates the non-sensitive continuation received from an email link. */
export function readLibraryOnboardingContinuation(params: URLSearchParams): LibraryOnboardingData | null {
  const displayName = (params.get("name") ?? "").trim();
  const libraryCode = normalizeLibraryCode(params.get("code") ?? "");
  const personName = (params.get("person") ?? "").trim();
  const currencyCode = canonicalizeCurrencyCode(params.get("currencyCode") ?? "");
  const localeCode = canonicalizeLocale(params.get("localeCode") ?? "");
  const timeZone = (params.get("timeZone") ?? "").trim();
  if (personName.length < 2 || personName.length > 120 || displayName.length < 3 || displayName.length > 160 || !validLibraryCode(libraryCode) || !currencyCode || !localeCode || !isSupportedTimeZone(timeZone)) return null;
  return { displayName, libraryCode, personName, currencyCode, localeCode, timeZone };
}

export async function finalizeLibraryOnboarding(
  supabase: SupabaseClient<Database>,
  onboarding: LibraryOnboardingData,
): Promise<LibraryFinalization> {
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return { ok: false, message: "Please verify your account, then continue creating your Library Room." };
  if (await getOperatorContextFromClient(supabase)) return { ok: true };

  const { data, error } = await asOperatorRpcClient(supabase).rpc("create_library_room", {
    p_display_name: onboarding.displayName,
    p_public_code: onboarding.libraryCode,
    p_creator_display_name: onboarding.personName,
    p_currency_code: onboarding.currencyCode,
    p_locale_code: onboarding.localeCode,
    p_time_zone: onboarding.timeZone,
  });

  if (error || !data) {
    const message = error?.message ?? "";
    if (message.includes("GS_LIBRARY_CODE_TAKEN")) return { ok: false, message: "That Library Code is already in use." };
    if (message.includes("GS_LIBRARY_LOCALIZATION_INVALID")) return { ok: false, message: "Choose a valid currency, locale, and IANA timezone." };
    if (message.includes("GS_PROFILE_INACTIVE")) return { ok: false, message: "This account is inactive and cannot create a Library Room." };
    return { ok: false, message: "The Library Room could not be created. Please try again." };
  }

  return { ok: true };
}
