import Link from "next/link";
import { BookCopy, BookOpen, Repeat2, Search, Users } from "lucide-react";
import { OperatorPageHeader } from "@/components/operator/page-header";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchResult = { result_type: "book" | "copy" | "member" | "loan"; result_id: string; title: string; subtitle: string };
const resultMeta = {
  book: { label: "Book", Icon: BookOpen, path: "catalogue" },
  copy: { label: "Copy", Icon: BookCopy, path: "inventory" },
  member: { label: "Member", Icon: Users, path: "members" },
  loan: { label: "Loan", Icon: Repeat2, path: "circulation" },
} as const;

export default async function OperatorSearchPage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]);
  const q = query.q?.trim() ?? "";
  let results: SearchResult[] = [];
  if (q.length >= 2) {
    const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_global_search", { p_library_code: libraryCode, p_query: q });
    if (!error && Array.isArray(data)) results = data as SearchResult[];
  }

  return <section className="operator-page-v3 search-results-page">
    <OperatorPageHeader title="Global search" description="Room-scoped results across catalogue, inventory, members, and circulation." />
    <form className="search-results-form"><Search aria-hidden="true" /><label className="sr-only" htmlFor="search-results-input">Search this Library Room</label><input id="search-results-input" name="q" defaultValue={q} minLength={2} required placeholder="Search this room" autoFocus /><button className="button button-primary" type="submit">Search</button></form>
    {q && !results.length ? <div className="empty-state"><h2>No results for “{q}”</h2><p>Try a title, author, accession number, barcode, member name, class, section, roll number, or member identifier.</p></div> : null}
    {results.length ? <div className="search-result-list">{results.map((result) => { const meta = resultMeta[result.result_type]; const destination = result.result_type === "loan" ? `/operator/${libraryCode}/circulation?q=${encodeURIComponent(result.result_id)}` : `/operator/${libraryCode}/${meta.path}/${result.result_id}`; return <Link key={`${result.result_type}-${result.result_id}`} href={destination}><meta.Icon aria-hidden="true" /><span><small>{meta.label}</small><strong>{result.title}</strong><span>{result.subtitle}</span></span></Link>; })}</div> : null}
  </section>;
}
