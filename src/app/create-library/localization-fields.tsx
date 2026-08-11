"use client";

import { useEffect, useRef } from "react";

export function LocalizationFields({ currencyCode, localeCode, timeZone }: { currencyCode: string; localeCode: string; timeZone: string }) {
  const locale = useRef<HTMLInputElement>(null); const timeZoneInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (locale.current?.value === "en-IN") locale.current.value = Intl.getCanonicalLocales(navigator.language)[0] ?? "en-IN";
    if (timeZoneInput.current?.value === "Asia/Kolkata") timeZoneInput.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  }, [localeCode, timeZone]);
  return <fieldset><legend>Localization</legend>
    <label>Operating currency<input name="currencyCode" defaultValue={currencyCode} pattern="[A-Za-z]{3}" minLength={3} maxLength={3} required autoCapitalize="characters" /><small>Choose this explicitly. GranthSetu never infers currency from location.</small></label>
    <label>Display locale<input ref={locale} name="localeCode" defaultValue={localeCode} minLength={2} maxLength={64} required /></label>
    <label>Library timezone<input ref={timeZoneInput} name="timeZone" defaultValue={timeZone} minLength={3} maxLength={64} required /></label>
  </fieldset>;
}
