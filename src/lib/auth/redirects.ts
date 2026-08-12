const FALLBACK_APP_URL = "http://127.0.0.1:3000";

function trustedPreviewUrl() {
  const deploymentHost = process.env.VERCEL_BRANCH_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!deploymentHost) return null;

  try {
    return normaliseAppUrl(deploymentHost.startsWith("https://") ? deploymentHost : `https://${deploymentHost}`);
  } catch {
    return null;
  }
}

function normaliseAppUrl(raw: string) {
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("The canonical application URL is invalid.");
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

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
  // Preview always returns to this exact Vercel deployment, even if a shared
  // production environment variable contains the canonical production URL.
  if (process.env.VERCEL_ENV === "preview") {
    const previewUrl = trustedPreviewUrl();
    if (previewUrl) return previewUrl;
    throw new Error("A valid Vercel Preview deployment origin is required.");
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    if (configured) {
      const appUrl = normaliseAppUrl(configured);
      if (process.env.NODE_ENV === "production" && isLocalhost(new URL(appUrl).hostname)) {
        throw new Error("Production cannot use a localhost canonical application URL.");
      }
      return appUrl;
    }
  } catch {
    if (process.env.NODE_ENV === "production") throw new Error("A valid NEXT_PUBLIC_SITE_URL is required in production.");
  }

  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  return FALLBACK_APP_URL;
}

export function getAuthCallbackUrl(next: string | null | undefined) {
  const safeNext = sanitizeNextPath(next, "/update-password");
  return `${getTrustedAppUrl()}/auth/confirm?next=${encodeURIComponent(safeNext)}`;
}

export function getLibraryOnboardingCallbackUrl(next: string) {
  const safeNext = sanitizeNextPath(next, "/create-library");
  return `${getTrustedAppUrl()}/auth/confirm-library?next=${encodeURIComponent(safeNext)}`;
}
import "server-only";
