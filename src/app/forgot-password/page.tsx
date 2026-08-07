import Link from "next/link";
import { RecoveryForm } from "@/app/forgot-password/recovery-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="recovery-title">
        <Link className="auth-brand" href="/">GranthSetu</Link>
        <p className="auth-kicker">Account recovery</p>
        <h1 id="recovery-title">Reset your password</h1>
        <p className="auth-copy">Enter your operator email. We will show the same confirmation whether or not an eligible account exists.</p>
        <RecoveryForm />
      </section>
    </main>
  );
}
