export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function getOptionalPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getOptionalPublicSupabaseEnv();
  if (!env) throw new Error("Supabase public environment variables are not configured.");
  return env;
}
