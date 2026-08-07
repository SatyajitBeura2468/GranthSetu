const FALLBACK_APP_URL = "http://127.0.0.1:3000";

export function sanitizeNextPath(value: string | null | undefined, fallback = "/operator") {
  if (!value) return fallback;

  let candidate = value;
  try {
    for (let index = 0; index < 2; index += 1) candidate = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "http://granthsetu.internal");
    if (parsed.origin !== "http://granthsetu.internal") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function getTrustedAppUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_URL?.trim();
  const raw = configured || (vercelHost ? `https://${vercelHost}` : FALLBACK_APP_URL);

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return FALLBACK_APP_URL;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return FALLBACK_APP_URL;
  }
}

export function getAuthCallbackUrl(next: string | null | undefined) {
  const safeNext = sanitizeNextPath(next, "/update-password");
  return `${getTrustedAppUrl()}/auth/confirm?next=${encodeURIComponent(safeNext)}`;
}
import "server-only";
