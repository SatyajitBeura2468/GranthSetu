export const RESERVED_LIBRARY_CODES = new Set(["ADMIN", "API", "AUTH", "LOGIN", "STAFF", "OPERATOR", "CREATE", "SUPPORT", "HELP", "ROOT", "SYSTEM", "GRANTHSETU"]);

export function normalizeLibraryCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "").slice(0, 16);
}

export function validLibraryCode(value: string) {
  const normalized = normalizeLibraryCode(value);
  return /^[A-Z0-9](?:[A-Z0-9-]{3,14})[A-Z0-9]$/.test(normalized) && !normalized.includes("--") && !RESERVED_LIBRARY_CODES.has(normalized);
}
