import Link from "next/link";
import { requireOperator } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveCopyAction } from "./actions";

type CopyRow = { id: string; book_id: string; title: string; accession_number: string; barcode: string | null; location_name: string | null; operational_state: string; condition_status: string; on_loan: boolean };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  await requireOperator();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const rpc = asOperatorRpcClient(supabase);
  const [{ data }, { data: books }, { data: locations }] = await Promise.all([
    rpc.rpc("inventory_copies", { p_search: params.q ?? "" }),
    supabase.from("books").select("id,title").eq("status", "active").order("title"),
    supabase.from("locations").select("id,display_name").eq("status", "active").order("display_name"),
  ]);
  const copies = (data ?? []) as CopyRow[];

  return (
    <section className="operator-page" aria-labelledby="inventory-title">
      <Link className="auth-secondary-link" href="/operator">← Operator workspace</Link>
      <p className="auth-kicker">Inventory administration</p>
      <h1 id="inventory-title">Physical copies</h1>
      <p className="operator-lede">Accession numbers identify physical copies. On-loan state is derived from active loans and cannot be manually faked.</p>
      {params.error ? <p className="auth-error" role="alert">{params.error}</p> : null}
      {params.success ? <p className="auth-success" role="status">{params.success}</p> : null}
      <div className="operator-actions"><Link className="button button-quiet" href="/operator/catalogue">Catalogue</Link></div>
      <form className="operator-invite" action={saveCopyAction}>
        <h2>Add physical copy</h2>
        <div className="operator-form-grid">
          <label className="auth-field">Book<select name="bookId" required><option value="">Choose book</option>{(books ?? []).map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
          <label className="auth-field">Accession number<input name="accessionNumber" required maxLength={120} /></label>
          <label className="auth-field">Barcode<input name="barcode" maxLength={120} /></label>
          <label className="auth-field">Location<select name="locationId" defaultValue=""><option value="">Unassigned</option>{(locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.display_name}</option>)}</select></label>
          <label className="auth-field">Condition<select name="conditionStatus" defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select></label>
          <label className="auth-field">Operational state<select name="operationalState" defaultValue="active"><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="damaged">Damaged</option><option value="withdrawn">Withdrawn</option></select></label>
        </div>
        <button className="button" type="submit">Create copy</button>
      </form>
      <form className="operator-search" method="get"><label className="auth-field">Search copies<input name="q" defaultValue={params.q ?? ""} placeholder="Title, accession, or barcode" /></label><button className="button button-small" type="submit">Search</button></form>
      <div className="operator-table-wrap"><table className="operator-table"><caption>Copies ({copies.length})</caption><thead><tr><th>Book</th><th>Accession</th><th>Location</th><th>Lifecycle</th><th>Derived circulation</th><th>Controls</th></tr></thead><tbody>{copies.map((copy) => <tr key={copy.id}><th scope="row">{copy.title}</th><td>{copy.accession_number}{copy.barcode ? <><br /><span className="operator-muted">{copy.barcode}</span></> : null}</td><td>{copy.location_name ?? "Unassigned"}</td><td>{copy.operational_state} · {copy.condition_status}</td><td>{copy.on_loan ? "On loan" : copy.operational_state === "active" ? "Available" : "Unavailable"}</td><td><Link className="button button-small button-quiet" href={`/operator/inventory/${copy.id}`}>Edit</Link></td></tr>)}</tbody></table></div>
    </section>
  );
}
