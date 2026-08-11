import { createClient } from "@supabase/supabase-js";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.API_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("E2E requires local Supabase URL and service-role key.");
  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email: "e2e-owner@granthsetu.test",
    password: "E2e-Owner-Password-2026!",
    email_confirm: true,
    user_metadata: { display_name: "E2E Owner" },
  });
  if (error && !error.message.toLowerCase().includes("already")) throw error;
}
