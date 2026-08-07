import Link from "next/link";
import { redirect } from "next/navigation";
import { getOperatorContext } from "@/lib/auth/authorization";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  try {
    if (await getOperatorContext()) redirect("/operator");
  } catch {
    // Public login remains renderable when Supabase is intentionally unconfigured.
  }

  const params = await searchParams;
  const next = sanitizeNextPath(params.next, "/operator");

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" href="/">GranthSetu</Link>
        <p className="auth-kicker">OAV Musiguda library</p>
        <h1 id="login-title">Operator sign in</h1>
        <p className="auth-copy">Use your approved GranthSetu operator account to continue.</p>
        <LoginForm next={next} />
      </section>
    </main>
  );
}
