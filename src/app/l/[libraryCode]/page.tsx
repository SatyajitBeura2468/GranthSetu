import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers3 } from "lucide-react";
import { BookCard } from "@/components/catalogue/book-card";
import { CatalogueSearch } from "@/components/public/catalogue-search";
import { getPublicCatalogue, getPublicLibrary, getPublicNewTitles } from "@/lib/library/public-data";

export async function generateMetadata({ params }: { params: Promise<{ libraryCode: string }> }): Promise<Metadata> {
  const library = await getPublicLibrary((await params).libraryCode);
  return { title: library?.displayName ?? "Library Room", description: library ? `Search the public catalogue of ${library.displayName}.` : "Library Room not found.", robots: library ? { index: true, follow: true } : { index: false, follow: false } };
}

export default async function PublicRoomPage({ params }: { params: Promise<{ libraryCode: string }> }) {
  const { libraryCode } = await params;
  const [library, books, newTitles] = await Promise.all([getPublicLibrary(libraryCode), getPublicCatalogue(libraryCode), getPublicNewTitles(libraryCode)]);
  if (!library) return null;
  const catalogue = books ?? [];
  const available = catalogue.filter((book) => book.availableCopies > 0);
  const categories = Array.from(new Set(catalogue.flatMap((book) => book.categoryNames))).slice(0, 8);
  return <>
    <section className="room-hero"><div><span className="room-overline">{library.displayName}</span><h1>Find the book<br />you came for.</h1><p>Search this institution&apos;s public catalogue. Availability is current when the library data service is connected.</p></div><div className="room-search-panel"><CatalogueSearch code={library.code} /><dl><div><dt>Catalogue</dt><dd>{books ? `${catalogue.length} titles shown` : "Temporarily unavailable"}</dd></div><div><dt>Privacy</dt><dd>No borrower data is public</dd></div></dl></div></section>
    <section className="catalogue-section" aria-labelledby="new-shelves"><header><div><p>Explore</p><h2 id="new-shelves">New to the shelves</h2></div><Link href={`/l/${library.code}/catalogue`}>Full catalogue<ArrowRight aria-hidden="true" /></Link></header>{newTitles === null ? <ReadError /> : newTitles.length ? <div className="book-grid">{newTitles.map((book, index) => <BookCard key={book.id} book={book} libraryCode={library.code} priority={index < 3} />)}</div> : <EmptyCatalogue />}</section>
    {available.length ? <section className="catalogue-section catalogue-section-tinted" aria-labelledby="available-now"><header><div><p>Ready to borrow</p><h2 id="available-now">Available now</h2></div><Link href={`/l/${library.code}/catalogue?available=1`}>View all<ArrowRight aria-hidden="true" /></Link></header><div className="book-grid book-grid-compact">{available.slice(0, 6).map((book) => <BookCard key={book.id} book={book} libraryCode={library.code} />)}</div></section> : null}
    {categories.length ? <section className="category-rail" aria-labelledby="browse-categories"><header><p>Browse</p><h2 id="browse-categories">By category</h2></header><div>{categories.map((category) => <Link key={category} href={`/l/${library.code}/catalogue?q=${encodeURIComponent(category)}`}><Layers3 aria-hidden="true" />{category}</Link>)}</div></section> : null}
  </>;
}

function EmptyCatalogue() { return <div className="empty-state"><BookOpen aria-hidden="true" /><h3>No books have been published here yet</h3><p>When this library makes catalogue records public, they will appear in this room.</p></div>; }
function ReadError() { return <div className="empty-state empty-state-error"><h3>The catalogue could not be loaded</h3><p>This is different from an empty library. Please try again shortly.</p></div>; }
