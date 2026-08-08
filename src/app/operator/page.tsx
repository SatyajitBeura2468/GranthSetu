import Link from "next/link";
import { requireOperator, hasRole } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await requireOperator();
  const params = await searchParams;
  const rpc = asOperatorRpcClient(await createSupabaseServerClient());
  const [{ data: dashboard, error: dashboardError }, searchResponse] = await Promise.all([
    rpc.rpc("operator_dashboard"),
    params.q ? rpc.rpc("global_search_v71", { p_query: params.q }) : Promise.resolve({ data: [], error: null }),
  ]);
  const searchResults = searchResponse.data;
  const searchError = searchResponse.error;
  const metrics = (Array.isArray(dashboard) ? dashboard[0] : dashboard) as { total_books?: number; total_copies?: number; available_copies?: number; active_loans?: number; overdue_loans?: number; active_members?: number; fines_outstanding_minor?: number } | null;
  const results = (Array.isArray(searchResults) ? searchResults : []) as Array<{ result_type: string; result_id: string; label: string; detail: string; status: string }>;
  return (
    <section className="operator-page" aria-labelledby="operator-title">
      <p className="auth-kicker">OAV Musiguda library</p>
      <h1 id="operator-title">Operator workspace</h1>
      <p className="operator-lede">Authoritative operational workspace for catalogue, inventory, members, circulation, policy, and reporting.</p>
      <div className="operator-grid">
        <article className="operator-card"><span className="operator-card-label">Signed in as</span><strong>{context.displayName}</strong><span className="operator-muted">{context.roles.join(" · ")}</span></article>
        <article className="operator-card"><span className="operator-card-label">Access state</span><strong>Active</strong><span className="operator-muted">Database-authoritative role checks are enabled.</span></article>
      </div>
      {dashboardError ? <p className="auth-error" role="alert">Authoritative dashboard data is unavailable. The counts below are intentionally withheld.</p> : <div className="operator-grid"><article className="operator-card"><span className="operator-card-label">Catalogue</span><strong>{metrics?.total_books ?? 0} active books</strong><span className="operator-muted">{metrics?.available_copies ?? 0} of {metrics?.total_copies ?? 0} copies available</span></article><article className="operator-card"><span className="operator-card-label">Circulation</span><strong>{metrics?.active_loans ?? 0} active loans</strong><span className="operator-muted">{metrics?.overdue_loans ?? 0} overdue · ₹{((metrics?.fines_outstanding_minor ?? 0) / 100).toFixed(2)} outstanding fines</span></article><article className="operator-card"><span className="operator-card-label">Members</span><strong>{metrics?.active_members ?? 0} active members</strong><span className="operator-muted">Borrowing counts are derived, never edited.</span></article></div>}
      <form className="operator-search" method="get"><label className="auth-field">Global search<input name="q" defaultValue={params.q ?? ""} placeholder="Books, members, or active loans" /></label><button className="button button-small" type="submit">Search</button></form>
      {params.q ? <div className="lookup-list" aria-live="polite">{searchError ? <span className="auth-error" role="alert">Search is unavailable; no conclusion can be drawn from this failed read.</span> : results.length ? results.map((result) => <Link key={`${result.result_type}-${result.result_id}`} href={result.result_type === "book" ? `/operator/catalogue/${result.result_id}` : result.result_type === "member" ? `/operator/members/${result.result_id}` : "/operator/circulation"}>{result.label} · {result.detail} · {result.status}</Link>) : <span>No matching records.</span>}</div> : null}
      <div className="operator-actions"><Link className="button" href="/operator/circulation">Open circulation</Link><Link className="button button-quiet" href="/operator/catalogue">Catalogue</Link><Link className="button button-quiet" href="/operator/members">Members</Link><Link className="button button-quiet" href="/operator/reports">Reports</Link>{hasRole(context, "administrator") ? <><Link className="button button-quiet" href="/operator/settings">Settings</Link><Link className="button button-quiet" href="/operator/admin/operators">Manage operators</Link><Link className="button button-quiet" href="/operator/admin/audit">Audit history</Link></> : null}</div>
    </section>
  );
}
