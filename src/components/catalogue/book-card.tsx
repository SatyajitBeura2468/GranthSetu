import Link from "next/link";
import { Availability } from "./availability";
import { BookCover } from "./book-cover";
import type { PublicBook } from "@/lib/library/public-data";

export function BookCard({ book, libraryCode, localeCode = "en-IN", priority = false }: { book: PublicBook; libraryCode: string; localeCode?: string; priority?: boolean }) {
  const coverUrl = book.hasCover ? `/api/public/libraries/${encodeURIComponent(libraryCode)}/covers/${book.id}` : null;
  return <article className="book-card"><Link href={`/l/${libraryCode}/catalogue/${book.id}`} className="book-card-cover"><BookCover title={book.title} author={book.authorNames} coverUrl={coverUrl} priority={priority} /></Link><div className="book-card-copy"><p>{book.categoryNames[0] ?? "Catalogue"}</p><h3><Link href={`/l/${libraryCode}/catalogue/${book.id}`}>{book.title}</Link></h3><span>{book.authorNames}</span><Availability book={book} localeCode={localeCode} /></div></article>;
}
