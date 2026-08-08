import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveCopyAction } from "../actions";

export default async function EditCopyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireOperator();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: copy }, { data: books }, { data: locations }] = await Promise.all([
    supabase.from("book_copies").select("id,book_id,accession_number,barcode,location_id,acquired_on,acquisition_source,replacement_cost_minor,condition_status,operational_state,updated_at").eq("id", id).maybeSingle(),
    supabase.from("books").select("id,title").order("title"),
    supabase.from("locations").select("id,display_name").order("display_name"),
  ]);
  if (!copy) notFound();
  return <section className="operator-page" aria-labelledby="copy-title">
    <Link className="auth-secondary-link" href="/operator/inventory">← Inventory</Link>
    <p className="auth-kicker">Inventory administration</p><h1 id="copy-title">Edit physical copy</h1>
    {query.error ? <p className="auth-error" role="alert">{query.error}</p> : null}{query.success ? <p className="auth-success" role="status">{query.success}</p> : null}
    <form className="operator-invite" action={saveCopyAction}><input type="hidden" name="id" value={copy.id} /><input type="hidden" name="expectedUpdatedAt" value={copy.updated_at} /><div className="operator-form-grid">
      <label className="auth-field">Book<select name="bookId" defaultValue={copy.book_id} required>{(books ?? []).map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
      <label className="auth-field">Accession number<input name="accessionNumber" defaultValue={copy.accession_number} required maxLength={120} /></label>
      <label className="auth-field">Barcode<input name="barcode" defaultValue={copy.barcode ?? ""} maxLength={120} /></label>
      <label className="auth-field">Location<select name="locationId" defaultValue={copy.location_id ?? ""}><option value="">Unassigned</option>{(locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.display_name}</option>)}</select></label>
      <label className="auth-field">Acquired on<input name="acquiredOn" type="date" defaultValue={copy.acquired_on ?? ""} /></label>
      <label className="auth-field">Replacement cost (INR)<input name="replacementCost" type="number" min="0" step="0.01" defaultValue={copy.replacement_cost_minor === null ? "" : copy.replacement_cost_minor / 100} /></label>
      <label className="auth-field">Condition<select name="conditionStatus" defaultValue={copy.condition_status}><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select></label>
      <label className="auth-field">Operational state<select name="operationalState" defaultValue={copy.operational_state}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="damaged">Damaged</option><option value="withdrawn">Withdrawn</option></select></label>
    </div><button className="button" type="submit">Save copy</button></form>
  </section>;
}
