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
  const minor = BigInt(joined);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const result = Number(minor);
  return match[1] === "-" ? -result : result;
}

function splitMinorUnits(value: number | string | null | undefined, currency: string) {
  const digits = currencyFractionDigits(currency);
  if (digits === null || value === null || value === undefined || value === "") return null;
  try {
    const minor = BigInt(value);
    const negative = minor < BigInt(0);
    const absolute = negative ? -minor : minor;
    const factor = BigInt(10) ** BigInt(digits);
    return { digits, negative, major: absolute / factor, fraction: (absolute % factor).toString().padStart(digits, "0") };
  } catch { return null; }
}

export function formatMoneyMinorUnits(value: number | string | null | undefined, currency: string, locale = "en") {
  const normalized = canonicalizeCurrencyCode(currency);
  const parts = normalized ? splitMinorUnits(value, normalized) : null;
  if (!normalized || !parts) return "—";
  const whole = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(parts.major);
  const template = new Intl.NumberFormat(locale, { style: "currency", currency: normalized, currencyDisplay: "symbol", signDisplay: "never" }).formatToParts(0);
  const rendered = template.map((part) => {
    if (part.type === "integer") return whole;
    if (part.type === "decimal") return parts.digits ? part.value : "";
    if (part.type === "fraction") return parts.digits ? parts.fraction : "";
    return part.value;
  }).join("");
  return parts.negative ? `-${rendered}` : rendered;
}

export function formatMinorUnitsForInput(value: number | string | null | undefined, currency: string) {
  const parts = splitMinorUnits(value, currency);
  if (!parts) return "";
  return `${parts.negative ? "-" : ""}${parts.major.toString()}${parts.digits ? `.${parts.fraction}` : ""}`;
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

export function libraryDateKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
