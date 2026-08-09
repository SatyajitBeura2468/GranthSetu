import Link from "next/link";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { MemberForm } from "@/components/operator/member-form";
import { getWorkspaceData } from "@/lib/operator/workspace";

type Member = { id: string; member_identifier: string; display_name: string; member_kind: string; status: string; updated_at: string };
type Enrollment = { academic_session_id?: string; grade_level_id?: string; section_id?: string; roll_number?: string; status?: string };
type Option = { id: string; display_label?: string; display_name?: string };
export default async function MemberWorkspacePage({ params, searchParams }: { params: Promise<{ libraryCode: string; id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ libraryCode, id }, query] = await Promise.all([params, searchParams]); const data = await getWorkspaceData(libraryCode, "members", "", id); const member = data.member as Member | undefined; if (!member) notFound();
  return <section className="operator-page-v3 detail-workspace"><Link className="back-link" href={`/operator/${libraryCode}/members`}><ArrowLeft aria-hidden="true" />Members</Link><OperatorPageHeader title={member.display_name} description={`${member.member_identifier} · ${member.member_kind}`} /><Feedback error={query.error ?? data.error} success={query.success} /><div className="detail-columns"><section><MemberForm libraryCode={libraryCode} member={member} enrollment={data.enrollment as Enrollment | undefined} sessions={(data.sessions ?? []) as Option[]} grades={(data.grades ?? []) as Option[]} sections={(data.sections ?? []) as Option[]} disabled={Boolean(data.demo)} /></section><aside><h2><BookOpenCheck aria-hidden="true" />Borrowing</h2><p>Circulation eligibility is revalidated atomically whenever a copy is issued or renewed.</p><Link className="button button-secondary" href={`/operator/${libraryCode}/circulation?q=${encodeURIComponent(member.member_identifier)}`}>Open circulation</Link></aside></div></section>;
}
