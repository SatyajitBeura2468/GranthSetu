import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPrivilegedSupabaseEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const { url, secretKey } = getPrivilegedSupabaseEnv();
  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
