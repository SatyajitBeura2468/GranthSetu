import "server-only";

import { getPublicSupabaseEnv } from "@/lib/env/public";

export const APPROVED_DEVELOPMENT_PROJECT_REF = "jyvvxseeytjyhuinyzgn";

function getProjectRef(url: string) {
  const parsed = new URL(url);
  const [ref] = parsed.hostname.split(".");
  if (parsed.protocol !== "https:" || !ref || parsed.hostname !== `${ref}.supabase.co`) {
    throw new Error("Supabase URL is not a valid hosted Supabase project URL.");
  }
  return ref;
}

export function getServerSupabaseEnv() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return { url, publishableKey, projectRef: getProjectRef(url) };
}

export function getPrivilegedSupabaseEnv() {
  const { url, projectRef } = getServerSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const isProduction = process.env.VERCEL_ENV === "production";

  if (isProduction) {
    throw new Error("Privileged Supabase operations are disabled in Production.");
  }
  if (projectRef !== APPROVED_DEVELOPMENT_PROJECT_REF) {
    throw new Error("Privileged Supabase operations require the approved Development project.");
  }
  if (!secretKey) {
    throw new Error("The Development Supabase secret key is not configured.");
  }

  return { url, secretKey, projectRef };
}
