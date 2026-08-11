export function canonicalizeCurrencyCode(value: string) {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  try { new Intl.NumberFormat("en", { style: "currency", currency }); return currency; } catch { return null; }
}

export function currencyFractionDigits(currency: string, locale = "en") {
  const normalized = canonicalizeCurrencyCode(currency);
  if (!normalized) return null;
  return new Intl.NumberFormat(locale, { style: "currency", currency: normalized }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function moneyInputStep(currency: string) {
  const digits = currencyFractionDigits(currency);
  return digits === null ? null : digits === 0 ? "1" : `0.${"0".repeat(digits - 1)}1`;
}

export function parseMoneyToMinorUnits(value: string, currency: string, allowNegative = false): number | null {
  const digits = currencyFractionDigits(currency);
  const raw = value.trim();
  if (digits === null || !raw || /[eE]/.test(raw)) return null;
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match || (match[1] === "-" && !allowNegative) || (match[3]?.length ?? 0) > digits) return null;
  const joined = `${match[2]}${(match[3] ?? "").padEnd(digits, "0")}`;
  const minor = Number(joined);
  if (!Number.isSafeInteger(minor)) return null;
  return match[1] === "-" ? -minor : minor;
}

export function formatMoneyMinorUnits(value: number | string | null | undefined, currency: string, locale = "en") {
  const normalized = canonicalizeCurrencyCode(currency);
  const digits = normalized ? currencyFractionDigits(normalized, locale) : null;
  const minor = typeof value === "string" ? Number(value) : value ?? null;
  if (!normalized || digits === null || minor === null || !Number.isSafeInteger(minor)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: normalized }).format(minor / 10 ** digits);
}

export function canonicalizeLocale(value: string) {
  try { return Intl.getCanonicalLocales(value.trim())[0] ?? null; } catch { return null; }
}

export function isSupportedTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return Boolean(value.trim()); } catch { return false; }
}

export function formatLibraryDateTime(value: string | Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

export function formatLibraryDate(value: string | Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
}

export function formatDateOnly(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
