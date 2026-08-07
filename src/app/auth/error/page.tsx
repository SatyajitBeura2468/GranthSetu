import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-error-title">
        <Link className="auth-brand" href="/">GranthSetu</Link>
        <p className="auth-kicker">Authentication</p>
        <h1 id="auth-error-title">That link could not be completed</h1>
        <p className="auth-copy">This authentication link is invalid, expired, or could not be completed.</p>
        <div className="auth-links"><Link className="auth-secondary-link" href="/login">Return to sign in</Link><Link className="auth-secondary-link" href="/forgot-password">Request a new recovery link</Link></div>
      </section>
    </main>
  );
}
