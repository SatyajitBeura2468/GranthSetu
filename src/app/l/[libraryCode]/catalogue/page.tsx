import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Grid2X2, List } from "lucide-react";
import { BookCard } from "@/components/catalogue/book-card";
import { CatalogueSearch } from "@/components/public/catalogue-search";
import { getPublicCataloguePage, getPublicLibrary } from "@/lib/library/public-data";

export const metadata: Metadata = { title: "Catalogue" };

export default async function PublicCataloguePage({ params, searchParams }: { params: Promise<{ libraryCode: string }>; searchParams: Promise<{ q?: string; available?: string; view?: string; page?: string }> }) {
  const [{ libraryCode }, query] = await Promise.all([params, searchParams]);
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const [library, result] = await Promise.all([getPublicLibrary(libraryCode), getPublicCataloguePage(libraryCode, query.q ?? "", query.available === "1", requestedPage)]);
  if (!library) return null;
  const list = result?.books ?? []; const resolvedPage = result?.page ?? requestedPage; const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return <section className="catalogue-page"><header className="page-heading"><div><p>{library.displayName}</p><h1>{query.available === "1" ? "Available now" : "Catalogue"}</h1><span>{query.q ? `Results for “${query.q}”` : result ? `${result.total} public title${result.total === 1 ? "" : "s"}` : "Browse every public title in this Library Room."}</span></div><div className="view-switcher" aria-label="View options"><Link className={query.view !== "list" ? "is-active" : ""} href={{ query: { ...query, view: "grid", page: "1" } }} aria-label="Grid view"><Grid2X2 aria-hidden="true" /></Link><Link className={query.view === "list" ? "is-active" : ""} href={{ query: { ...query, view: "list", page: "1" } }} aria-label="List view"><List aria-hidden="true" /></Link></div></header><CatalogueSearch code={library.code} defaultValue={query.q} available={query.available === "1"} />{result === null ? <div className="empty-state empty-state-error"><h2>Catalogue unavailable</h2><p>The library data service could not be reached. No zero counts are being inferred.</p></div> : list.length ? <>{query.view === "list" ? <div className="public-book-list">{list.map((book) => <article key={book.id}><BookCard book={book} libraryCode={library.code} /></article>)}</div> : <div className="book-grid catalogue-full-grid">{list.map((book) => <BookCard key={book.id} book={book} libraryCode={library.code} />)}</div>}<nav className="pagination" aria-label="Catalogue pages"><Link aria-disabled={resolvedPage <= 1} tabIndex={resolvedPage <= 1 ? -1 : undefined} href={{ query: { ...query, page: String(Math.max(1, resolvedPage - 1)) } }}>Previous</Link><span>Page {resolvedPage} of {totalPages}</span><Link aria-disabled={resolvedPage >= totalPages} tabIndex={resolvedPage >= totalPages ? -1 : undefined} href={{ query: { ...query, page: String(Math.min(totalPages, resolvedPage + 1)) } }}>Next</Link></nav></> : <div className="empty-state"><BookOpen aria-hidden="true" /><h2>No matching books</h2><p>Try a title, author, ISBN, subject, or broader phrase.</p><Link className="button button-secondary" href={`/l/${library.code}/catalogue`}>Clear search</Link></div>}</section>;
}
