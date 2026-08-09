import Link from "next/link";
import { ArrowRight, BookCheck, BookOpen, Clock3, IndianRupee, Repeat2, Users } from "lucide-react";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { getWorkspaceData } from "@/lib/operator/workspace";

type Metric = { label: string; value: string | number; icon: typeof Repeat2; urgent?: boolean; detail: string };

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]);
  const data = await getWorkspaceData(libraryCode, "dashboard");
  const m = (data.metrics ?? {}) as Record<string, number>;
  const metrics: Metric[] = [
    { label: "Active loans", value: m.activeLoans ?? "—", icon: Repeat2, detail: "Currently borrowed" },
    { label: "Overdue", value: m.overdueLoans ?? "—", icon: Clock3, urgent: Boolean(m.overdueLoans), detail: "Needs attention" },
    { label: "Available copies", value: m.availableCopies ?? "—", icon: BookCheck, detail: `${m.totalBooks ?? "—"} catalogue titles` },
    { label: "Active members", value: m.activeMembers ?? "—", icon: Users, detail: "Eligible member records" },
    { label: "Outstanding fines", value: typeof m.finesOutstandingMinor === "number" ? `₹${(m.finesOutstandingMinor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—", icon: IndianRupee, detail: "Recorded balance" },
  ];
  const attention = (data.attention ?? []) as Array<{ label: string; detail: string; tone: string }>;
  const activity = (data.activity ?? []) as Array<{ time: string; action: string; member: string; item: string }>;
  return <section className="operator-page-v3"><OperatorPageHeader title="Dashboard" description="What needs attention, what is happening now, and where to act next." actions={<Link className="button button-primary" href={`/operator/${libraryCode}/circulation`}><Repeat2 aria-hidden="true" />Open circulation</Link>} /><Feedback error={query.error ?? data.error} success={query.success} />
    <div className="metric-rail">{metrics.map(({ label, value, icon: Icon, urgent, detail }) => <article key={label} className={urgent ? "is-urgent" : ""}><Icon aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>)}</div>
    <div className="dashboard-grid"><section className="attention-panel"><header><div><p>Priority</p><h2>Attention</h2></div><Link href={`/operator/${libraryCode}/reports?kind=overdue`}>View overdue<ArrowRight aria-hidden="true" /></Link></header>{attention.length ? <div>{attention.map((item) => <article key={item.label} className={`attention-${item.tone}`}><span /><div><strong>{item.label}</strong><small>{item.detail}</small></div><ArrowRight aria-hidden="true" /></article>)}</div> : <div className="inline-empty"><BookCheck aria-hidden="true" /><span><strong>Nothing urgent right now</strong><small>There are no current attention items.</small></span></div>}</section>
      <section className="activity-panel"><header><div><p>Today</p><h2>Recent activity</h2></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Action</th><th>Member</th><th>Item / copy</th></tr></thead><tbody>{activity.map((row) => <tr key={`${row.time}-${row.item}`}><td>{row.time}</td><td><span className="status-dot status-success">{row.action}</span></td><td>{row.member}</td><td>{row.item}</td></tr>)}</tbody></table></div></section>
      <aside className="quick-operations"><header><p>Shortcuts</p><h2>Quick operations</h2></header><Link href={`/operator/${libraryCode}/circulation`}><Repeat2 aria-hidden="true" /><span><strong>Issue or return</strong><small>Open the circulation command centre</small></span><ArrowRight aria-hidden="true" /></Link><Link href={`/operator/${libraryCode}/catalogue`}><BookOpen aria-hidden="true" /><span><strong>Search catalogue</strong><small>Find books, authors, and copies</small></span><ArrowRight aria-hidden="true" /></Link><Link href={`/operator/${libraryCode}/members`}><Users aria-hidden="true" /><span><strong>Find a member</strong><small>View identity and borrowing state</small></span><ArrowRight aria-hidden="true" /></Link></aside>
    </div>
  </section>;
}
