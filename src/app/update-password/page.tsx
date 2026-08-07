import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/app/update-password/password-form";

export default async function UpdatePasswordPage() {
  try {
    const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
    if (!claims) redirect("/login");
  } catch {
    redirect("/login");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="update-password-title">
        <Link className="auth-brand" href="/">GranthSetu</Link>
        <p className="auth-kicker">Secure account setup</p>
        <h1 id="update-password-title">Choose a new password</h1>
        <p className="auth-copy">Use at least 12 characters. You will sign in again after the update.</p>
        <PasswordForm />
      </section>
    </main>
  );
}
