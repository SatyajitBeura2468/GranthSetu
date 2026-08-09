import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Brand } from "@/components/brand/brand";

export default async function LibraryCreatedPage({ searchParams }: { searchParams: Promise<{ code?: string; name?: string }> }) {
  const { code = "", name = "Library Room" } = await searchParams;
  return <main className="state-page state-page-success"><Brand /><Check aria-hidden="true" /><h1>Library created</h1><p>{name}</p><div className="created-code"><span>Library Code</span><strong>{code}</strong><Copy aria-hidden="true" /></div><div className="state-actions"><Link className="button button-primary" href={`/operator/${code}`}>Enter staff workspace</Link><Link className="button button-secondary" href={`/l/${code}`}>Open public library</Link></div></main>;
}
