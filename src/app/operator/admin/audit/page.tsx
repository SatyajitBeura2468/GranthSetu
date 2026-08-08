import Link from "next/link";
import { requireAdministrator } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; target?: string }> }) {
  await requireAdministrator();
  const params = await searchParams;
  const rpc = asOperatorRpcClient(await createSupabaseServerClient());
  const { data, error } = await rpc.rpc("admin_audit_events", { p_action: params.action?.trim() || null, p_target_type: params.target?.trim() || null });
  const rows = (Array.isArray(data) ? data : []) as Array<{ id: string; actor_name: string | null; action: string; target_type: string; target_id: string | null; occurred_at: string; metadata: unknown }>;
  return <section className="operator-page" aria-labelledby="audit-title"><Link className="auth-secondary-link" href="/operator">← Operator workspace</Link><p className="auth-kicker">Administrator controls</p><h1 id="audit-title">Audit history</h1><p className="operator-lede">Append-only operational history. Rows are not editable or deletable through the application.</p><form className="operator-search" method="get"><label className="auth-field">Action contains<input name="action" defaultValue={params.action ?? ""} /></label><label className="auth-field">Target type<input name="target" defaultValue={params.target ?? ""} /></label><button className="button button-small" type="submit">Filter</button></form>{error ? <p className="auth-error" role="alert">Audit history is unavailable. No conclusion can be drawn from this failed read.</p> : <div className="operator-table-wrap"><table className="operator-table"><caption>{rows.length} audit events</caption><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Context</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.occurred_at).toLocaleString()}</td><td>{row.actor_name ?? "System"}</td><td>{row.action}</td><td>{row.target_type} {row.target_id ?? ""}</td><td><code>{JSON.stringify(row.metadata)}</code></td></tr>)}</tbody></table></div>}</section>;
}
