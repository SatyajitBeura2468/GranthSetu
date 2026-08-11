"use client";

import { useEffect, useRef } from "react";

export function LocalizationFields() {
  const locale = useRef<HTMLInputElement>(null); const timeZone = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (locale.current?.value === "en-IN") locale.current.value = Intl.getCanonicalLocales(navigator.language)[0] ?? "en-IN";
    if (timeZone.current?.value === "Asia/Kolkata") timeZone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  }, []);
  return <fieldset><legend>Localization</legend>
    <label>Operating currency<input name="currencyCode" defaultValue="INR" pattern="[A-Za-z]{3}" minLength={3} maxLength={3} required autoCapitalize="characters" /><small>Choose this explicitly. GranthSetu never infers currency from location.</small></label>
    <label>Display locale<input ref={locale} name="localeCode" defaultValue="en-IN" minLength={2} maxLength={64} required /></label>
    <label>Library timezone<input ref={timeZone} name="timeZone" defaultValue="Asia/Kolkata" minLength={3} maxLength={64} required /></label>
  </fieldset>;
}
