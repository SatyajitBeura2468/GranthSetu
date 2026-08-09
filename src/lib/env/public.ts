export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

const DEVELOPMENT_PREVIEW_ENV: PublicSupabaseEnv = {
  url: "https://jyvvxseeytjyhuinyzgn.supabase.co",
  publishableKey: "sb_publishable_FCoexjN5sgoS017t6sGQaQ_8n8cTJQ4",
};

export function getOptionalPublicSupabaseEnv(): PublicSupabaseEnv | null {
  if (process.env.VERCEL_ENV === "preview") {
    return DEVELOPMENT_PREVIEW_ENV;
  }

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
