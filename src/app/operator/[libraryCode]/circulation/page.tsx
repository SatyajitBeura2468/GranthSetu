import { CirculationWorkbench } from "@/components/operator/circulation-workbench";
import { Feedback, OperatorPageHeader } from "@/components/operator/page-header";
import { getCirculationShellData } from "@/lib/operator/workspace";
import { requireLibraryOperator } from "@/lib/auth/authorization";

export default async function CirculationPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]); const [data, context] = await Promise.all([getCirculationShellData(libraryCode), requireLibraryOperator(libraryCode)]);
  return <section className="operator-page-v3 circulation-page-v3"><OperatorPageHeader title="Circulation" description="Issue, renew, and return from one transaction command centre." /><Feedback error={query.error ?? data.error} success={query.success} /><CirculationWorkbench libraryCode={libraryCode} currencyCode={context.currencyCode} localeCode={context.localeCode} timeZone={context.timeZone} members={(data.members ?? []) as never[]} copies={(data.copies ?? []) as never[]} loans={(data.loans ?? []) as never[]} disabled={Boolean(data.demo || data.error)} /></section>;
}
