import Link from "next/link";
import { requireOperator, hasRole } from "@/lib/auth/authorization";

export default async function OperatorPage() {
  const context = await requireOperator();
  return (
    <section className="operator-page" aria-labelledby="operator-title">
      <p className="auth-kicker">OAV Musiguda library</p>
      <h1 id="operator-title">Operator workspace</h1>
      <p className="operator-lede">Your authenticated workspace is ready. Library workflows will be introduced through separately reviewed phases.</p>
      <div className="operator-grid">
        <article className="operator-card"><span className="operator-card-label">Signed in as</span><strong>{context.displayName}</strong><span className="operator-muted">{context.roles.join(" · ")}</span></article>
        <article className="operator-card"><span className="operator-card-label">Access state</span><strong>Active</strong><span className="operator-muted">Database-authoritative role checks are enabled.</span></article>
      </div>
      {hasRole(context, "administrator") ? <Link className="button" href="/operator/admin/operators">Manage operators</Link> : null}
    </section>
  );
}
