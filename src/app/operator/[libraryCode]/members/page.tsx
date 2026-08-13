import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { MemberForm } from "@/components/operator/member-form";
import { OperatorToolbar } from "@/components/operator/toolbar";
import { getWorkspaceData } from "@/lib/operator/workspace";

type Member = { id: string; name: string; identifier: string; kind: string; context: string; activeLoans: number; status: string };
type Option = { id: string; display_label?: string; display_name?: string };

// Older room RPC payloads may contain a UTF-8 separator that was encoded twice.
// Normalize only this presentation string so member data and the RPC contract stay unchanged.
function normalizeAcademicContext(value: string) {
  return value.replaceAll("Ã‚Â·", "·").replaceAll("Â·", "·");
}

export default async function MembersPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]); const data = await getWorkspaceData(libraryCode, "members", query.q); const members = (data.members ?? []) as Member[];
  return <section className="operator-page-v3"><OperatorPageHeader title="Members" description="Borrowing identity, academic context, and current eligibility at a glance." /><Feedback error={query.error ?? data.error} success={query.success} /><OperatorToolbar query={query.q} addLabel="Add member"><MemberForm libraryCode={libraryCode} sessions={(data.sessions ?? []) as Option[]} grades={(data.grades ?? []) as Option[]} sections={(data.sections ?? []) as Option[]} disabled={Boolean(data.demo)} submitLabel="Create member" /></OperatorToolbar><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Kind</th><th>Academic context</th><th>Borrowing</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><Link href={`/operator/${libraryCode}/members/${member.id}`}><strong>{member.name}</strong><small>{member.identifier}</small></Link></td><td>{member.kind}</td><td>{normalizeAcademicContext(member.context)}</td><td>{member.activeLoans} active</td><td><span className={`status-dot ${member.status === "Active" ? "status-success" : "status-neutral"}`}>{member.status}</span></td><td><Link className="icon-button" href={`/operator/${libraryCode}/members/${member.id}`} aria-label={`Open ${member.name}`}><MoreHorizontal aria-hidden="true" /></Link></td></tr>)}</tbody></table>{!members.length && !data.error ? <div className="table-empty">No matching members</div> : null}</div></section>;
}
