"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string } | null;
const PASSWORD_ERROR = "Unable to update the password. The recovery or invitation session may be invalid or expired.";

export async function updatePasswordAction(_previousState: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password.length > 1024 || password !== confirmation) {
    return { error: "Use matching passwords with at least 12 characters." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims) return { error: PASSWORD_ERROR };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: PASSWORD_ERROR };
    await supabase.auth.signOut();
  } catch {
    return { error: PASSWORD_ERROR };
  }

  redirect("/login?passwordUpdated=1");
}
