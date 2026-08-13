import Link from "next/link";
import { MapPin } from "lucide-react";
import { getPublicLibrary, getPublicShelves } from "@/lib/library/public-data";

export default async function PublicShelvesPage({ params }: { params: Promise<{ libraryCode: string }> }) {
  const { libraryCode } = await params; const [library, shelves] = await Promise.all([getPublicLibrary(libraryCode), getPublicShelves(libraryCode)]);
  if (!library) return null;
  return <section className="catalogue-page"><header className="page-heading"><div><p>{library.displayName}</p><h1>Browse shelves</h1><span>Find titles by the shelves, racks, rooms, and sections where physical copies are stored.</span></div></header>{shelves?.length ? <div className="shelf-grid">{shelves.map((shelf) => <Link className="shelf-card" key={shelf.code} href={`/l/${library.code}/catalogue?shelf=${encodeURIComponent(shelf.code)}`}><MapPin aria-hidden="true" /><div><h2>{shelf.name}</h2><p>{shelf.code}</p></div><small>{shelf.titleCount} {shelf.titleCount === 1 ? "title" : "titles"} · {shelf.copyCount} copies · {shelf.availableCopyCount} available</small></Link>)}</div> : <div className="empty-state"><MapPin aria-hidden="true" /><h2>No shelves yet</h2><p>This library has not published any shelves with physical copies.</p></div>}</section>;
}
