import Link from "next/link";
import { MapPin } from "lucide-react";
import { Availability } from "./availability";
import { BookCover } from "./book-cover";
import type { PublicBook } from "@/lib/library/public-data";

export function BookCard({ book, libraryCode, localeCode = "en-IN", priority = false }: { book: PublicBook; libraryCode: string; localeCode?: string; priority?: boolean }) {
  const coverUrl = book.hasCover ? `/api/public/libraries/${encodeURIComponent(libraryCode)}/covers/${book.id}` : null;
  const shelfLabel = book.shelves.length === 1 ? `${book.shelves[0].name} · ${book.shelves[0].code}` : book.shelves.length > 1 ? `${book.shelves.length} shelves` : null;
  return <article className="book-card"><Link href={`/l/${libraryCode}/catalogue/${book.id}`} className="book-card-cover"><BookCover title={book.title} author={book.authorNames} coverUrl={coverUrl} priority={priority} /></Link><div className="book-card-copy"><p>{book.categoryNames[0] ?? "Catalogue"}</p><h3><Link href={`/l/${libraryCode}/catalogue/${book.id}`}>{book.title}</Link></h3><span>{book.authorNames}</span>{shelfLabel ? <small className="book-shelf-cue"><MapPin aria-hidden="true" />{shelfLabel}</small> : null}<Availability book={book} localeCode={localeCode} /></div></article>;
}
