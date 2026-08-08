export function parseMinorUnits(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const minor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

export function formatInrMinorUnits(value: number | string | null | undefined) {
  const minor = Number(value ?? 0);
  if (!Number.isSafeInteger(minor)) return "₹—";
  return `₹${(minor / 100).toFixed(2)}`;
}
