import Link from "next/link";
import { requireOperator } from "@/lib/auth/authorization";
import { asOperatorRpcClient, rpcErrorMessage } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportParams = { from?: string; to?: string; q?: string; status?: string; outstanding?: string };
const reportNames: Record<string, { label: string; rpc: string }> = { circulation: { label: "Circulation history", rpc: "report_circulation_filtered" }, overdue: { label: "Overdue loans", rpc: "report_overdue_filtered" }, popular: { label: "Popular books", rpc: "report_popular_books_filtered" }, members: { label: "Member activity", rpc: "report_member_activity_filtered" }, inventory: { label: "Inventory", rpc: "report_inventory_filtered" }, fines: { label: "Fines", rpc: "report_fines_filtered" } };
function dateOrNull(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function argsFor(kind: string, params: ReportParams) { const from = dateOrNull(params.from); const to = dateOrNull(params.to); if (kind === "overdue") return { p_as_of: to, p_query: params.q ?? "" }; if (kind === "popular") return { p_from: from, p_to: to }; if (kind === "members") return { p_from: from, p_to: to, p_query: params.q ?? "" }; if (kind === "inventory") return { p_status: params.status || null, p_location_id: null }; if (kind === "fines") return { p_from: from, p_to: to, p_query: params.q ?? "", p_outstanding_only: params.outstanding === "true" }; return { p_from: from, p_to: to, p_query: params.q ?? "" }; }
function exportQuery(kind: string, params: ReportParams) { const query = new URLSearchParams({ kind }); const from = dateOrNull(params.from); const to = dateOrNull(params.to); if (kind !== "inventory" && kind !== "overdue" && from) query.set("from", from); if (kind !== "inventory" && to) query.set("to", to); if (kind !== "popular" && kind !== "inventory" && params.q) query.set("q", params.q); if (kind === "inventory" && params.status) query.set("status", params.status); if (kind === "fines" && params.outstanding) query.set("outstanding", params.outstanding); return query.toString(); }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string } & ReportParams> }) {
  await requireOperator();
  const params = await searchParams;
  const kind = params.kind && reportNames[params.kind] ? params.kind : "circulation";
  const report = reportNames[kind];
  const rpc = asOperatorRpcClient(await createSupabaseServerClient());
  const { data, error } = await rpc.rpc(report.rpc, argsFor(kind, params));
  const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const query = exportQuery(kind, params);
  return <section className="operator-page" aria-labelledby="reports-title">
    <Link className="auth-secondary-link" href="/operator">← Operator workspace</Link>
    <p className="auth-kicker">Operational reporting</p><h1 id="reports-title">{report.label}</h1>
    <p className="operator-lede">Only filters supported by this report are shown and reused by the CSV export.</p>
    {error ? <p className="auth-error" role="alert">{rpcErrorMessage(error)}</p> : null}
    <form className="operator-search" method="get">
      <input type="hidden" name="kind" value={kind} />
      {kind === "overdue" ? <label className="auth-field">As of<input name="to" type="date" defaultValue={params.to ?? ""} /></label> : kind !== "inventory" ? <label className="auth-field">From<input name="from" type="date" defaultValue={params.from ?? ""} /></label> : null}
      {kind !== "inventory" && kind !== "overdue" ? <label className="auth-field">To<input name="to" type="date" defaultValue={params.to ?? ""} /></label> : null}
      {kind !== "popular" && kind !== "inventory" ? <label className="auth-field">Search<input name="q" defaultValue={params.q ?? ""} placeholder="Member, book, accession" /></label> : null}
      {kind === "inventory" ? <label className="auth-field">Copy status<input name="status" defaultValue={params.status ?? ""} placeholder="active / lost / damaged" /></label> : null}
      {kind === "fines" ? <label className="auth-field">Outstanding only<select name="outstanding" defaultValue={params.outstanding ?? "false"}><option value="false">All fines</option><option value="true">Outstanding only</option></select></label> : null}
      <button className="button button-small" type="submit">Apply filters</button>
    </form>
    <nav className="operator-actions" aria-label="Report types">{Object.entries(reportNames).map(([key, item]) => <Link key={key} className={`button button-small ${key === kind ? "" : "button-quiet"}`} href={`/operator/reports?kind=${key}`}>{item.label}</Link>)}</nav>
    <p><a href={`/operator/reports/export?${query}`}>Download filtered CSV</a> · {rows.length} rows</p>
    <div className="operator-table-wrap"><table className="operator-table"><caption>{report.label}</caption><thead><tr>{columns.map((column) => <th key={column} scope="col">{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.loan_id ?? row.book_id ?? row.member_id ?? row.fine_id ?? index)}>{columns.map((column) => <td key={column}>{typeof row[column] === "object" && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
