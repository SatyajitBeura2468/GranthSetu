import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { ShelfForm } from "@/components/operator/shelf-form";
import { getLibraryOperatorContext } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Shelf = { id: string; display_name: string; location_code: string; status: string; title_count: number; copy_count: number; available_copy_count: number };
export default async function ShelvesPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ error?: string; success?: string; edit?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]); const context = await getLibraryOperatorContext(libraryCode); if (!context) return null;
  const { data } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_shelf_summaries", { p_library_code: libraryCode }); const shelves = (data as Shelf[] ?? []); const editing = shelves.find((item) => item.id === query.edit);
  return <section className="operator-page-v3"><OperatorPageHeader title="Shelves" description="Organise physical copies by the shelves, racks, rooms, or sections where they are stored." /><Feedback error={query.error} success={query.success} /><div className="operator-toolbar"><details className="create-popover" open={Boolean(query.edit)}><summary className="button button-primary">{editing ? "Edit shelf" : "+ Add shelf"}</summary><div><ShelfForm libraryCode={libraryCode} shelf={editing} /></div></details><Link className="button button-secondary" href={`/operator/${libraryCode}/inventory`}>Back to inventory</Link></div>{shelves.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Shelf</th><th>Code</th><th>Titles</th><th>Copies</th><th>Available</th><th>Status</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{shelves.map((shelf) => <tr key={shelf.id}><td><strong>{shelf.display_name}</strong></td><td>{shelf.location_code}</td><td>{shelf.title_count}</td><td>{shelf.copy_count}</td><td>{shelf.available_copy_count}</td><td><span className={`status-dot ${shelf.status === "active" ? "status-success" : "status-warning"}`}>{shelf.status}</span></td><td><Link className="icon-button" href={`/operator/${libraryCode}/inventory/shelves?edit=${shelf.id}`} aria-label={`Edit ${shelf.display_name}`}><MoreHorizontal aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>No shelves yet</h2><p>Create shelves to help librarians and readers locate physical books.</p></div>}</section>;
}
