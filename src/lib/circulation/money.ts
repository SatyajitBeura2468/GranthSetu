import { formatMoneyMinorUnits, parseMoneyToMinorUnits } from "@/lib/i18n/library-localization";

export { formatMoneyMinorUnits, parseMoneyToMinorUnits } from "@/lib/i18n/library-localization";

// Compatibility alias for the existing INR room until all callers receive
// their room-scoped localization context.
export function parseMinorUnits(value: string) {
  return parseMoneyToMinorUnits(value, "INR");
}

export function formatInrMinorUnits(value: number | string | null | undefined) {
  return formatMoneyMinorUnits(value, "INR", "en-IN");
}
