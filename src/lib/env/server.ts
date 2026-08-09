import "server-only";

import { getPublicSupabaseEnv } from "@/lib/env/public";

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
  const expectedProjectRef = process.env.SUPABASE_EXPECTED_PROJECT_REF?.trim();

  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    throw new Error("The Supabase URL does not match SUPABASE_EXPECTED_PROJECT_REF.");
  }
  if (!secretKey) {
    throw new Error("The server-only Supabase secret key is not configured.");
  }

  return { url, secretKey, projectRef };
}
