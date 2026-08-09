export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

// These are intentionally public client configuration values for the official
// GranthSetu Production data plane. Environment variables always override them.
// No server/service secret belongs in this file.
const OFFICIAL_PRODUCTION_SUPABASE: PublicSupabaseEnv = {
  url: "https://rslkmylqvmzopgehjrkz.supabase.co",
  publishableKey: "sb_publishable_uE8Uw0dQ7MJRo4xJFp6Gzw_v-VS5C6F",
};

export function getOptionalPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && publishableKey) {
    return { url, publishableKey };
  }

  if (process.env.VERCEL_ENV === "production") {
    return OFFICIAL_PRODUCTION_SUPABASE;
  }

  return null;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getOptionalPublicSupabaseEnv();
  if (!env) throw new Error("Supabase public environment variables are not configured.");
  return env;
}
