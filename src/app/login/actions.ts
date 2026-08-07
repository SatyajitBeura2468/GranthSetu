"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOperatorContextFromClient } from "@/lib/auth/authorization";
import { sanitizeNextPath } from "@/lib/auth/redirects";

export type LoginState = { error: string } | null;

const GENERIC_LOGIN_ERROR = "Unable to sign in with those credentials or this account is not authorized for GranthSetu.";

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? ""), "/operator");

  if (!email || email.length > 320 || !password || password.length > 1024) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: GENERIC_LOGIN_ERROR };

    const context = await getOperatorContextFromClient(supabase);
    if (!context) {
      await supabase.auth.signOut();
      return { error: GENERIC_LOGIN_ERROR };
    }

    redirect(next);
  } catch {
    return { error: GENERIC_LOGIN_ERROR };
  }
}
