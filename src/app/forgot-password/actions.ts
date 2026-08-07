"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";

export type RecoveryState = { sent: boolean; error?: string };

export async function requestPasswordReset(_previousState: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 320) return { sent: false, error: "Enter a valid email address." };

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthCallbackUrl("/update-password") });
  } catch {
    // Keep account existence and configuration details out of the response.
  }

  return { sent: true };
}
