import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { CopyForm } from "@/components/operator/copy-form";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { OperatorToolbar } from "@/components/operator/toolbar";
import { getWorkspaceData } from "@/lib/operator/workspace";

type Copy = { id: string; accession: string; title: string; location: string; condition: string; state: string }; type BookOption = { id: string; title: string }; type Location = { id: string; display_name: string; location_code: string };
export default async function InventoryPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]); const data = await getWorkspaceData(libraryCode, "inventory", query.q); const copies = (data.copies ?? []) as Copy[];
  return <section className="operator-page-v3"><OperatorPageHeader title="Inventory" description="Every physical copy, its location, condition, and derived circulation state." /><Feedback error={query.error ?? data.error} success={query.success} /><OperatorToolbar query={query.q} addLabel="Add copy"><CopyForm libraryCode={libraryCode} books={(data.bookOptions ?? []) as BookOption[]} locations={(data.locations ?? []) as Location[]} disabled={Boolean(data.demo)} submitLabel="Create copy" /></OperatorToolbar><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Copy / accession</th><th>Book</th><th>Location</th><th>Condition</th><th>State</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{copies.map((copy) => <tr key={copy.id}><td className="tabular"><strong>{copy.accession}</strong></td><td>{copy.title}</td><td>{copy.location}</td><td>{copy.condition}</td><td><span className={`status-dot ${copy.state === "Available" ? "status-success" : copy.state === "On loan" ? "status-info" : "status-warning"}`}>{copy.state}</span></td><td><Link className="icon-button" href={`/operator/${libraryCode}/inventory/${copy.id}`} aria-label={`Open copy ${copy.accession}`}><MoreHorizontal aria-hidden="true" /></Link></td></tr>)}</tbody></table>{!copies.length && !data.error ? <div className="table-empty">No matching copies</div> : null}</div></section>;
}
