import Link from "next/link";
import { ArrowRight, BookOpen, MapPin } from "lucide-react";
import { getPublicLibrary, getPublicShelves } from "@/lib/library/public-data";

export default async function PublicShelvesPage({ params }: { params: Promise<{ libraryCode: string }> }) {
  const { libraryCode } = await params;
  const [library, shelves] = await Promise.all([getPublicLibrary(libraryCode), getPublicShelves(libraryCode)]);
  if (!library) return null;

  return <section className="catalogue-page shelf-directory-page">
    <header className="page-heading shelf-page-heading">
      <div>
        <p>{library.displayName}</p>
        <h1>Browse shelves</h1>
        <span>Choose a section to see its titles, current availability, and exact shelf location.</span>
      </div>
    </header>
    {shelves?.length ? <>
      <div className="shelf-directory-intro">
        <div><span>Find your section</span><strong>{shelves.length} active shelves to explore</strong></div>
        <p>Each card opens the matching collection in the catalogue.</p>
      </div>
      <div className="shelf-grid">
        {shelves.map((shelf) => {
          const academic = /^\d/.test(shelf.code);
          return <Link className={`shelf-card${academic ? " is-academic" : ""}`} key={shelf.code} href={`/l/${library.code}/catalogue?shelf=${encodeURIComponent(shelf.code)}`} aria-label={`Explore ${shelf.name}: ${shelf.titleCount} titles, ${shelf.availableCopyCount} available`}>
            <div className="shelf-card-heading"><span className="shelf-card-icon"><MapPin aria-hidden="true" /></span><span className="shelf-card-code">{shelf.code}</span></div>
            <div className="shelf-card-copy"><h2>{shelf.name}</h2><p>{academic ? "Class collection" : "Library collection"}</p></div>
            <div className="shelf-card-stats"><span><strong>{shelf.titleCount}</strong><small>{shelf.titleCount === 1 ? "title" : "titles"}</small></span><span><strong>{shelf.copyCount}</strong><small>{shelf.copyCount === 1 ? "copy" : "copies"}</small></span><span><strong>{shelf.availableCopyCount}</strong><small>available</small></span></div>
            <span className="shelf-card-action"><BookOpen aria-hidden="true" />Explore collection<ArrowRight aria-hidden="true" /></span>
          </Link>;
        })}
      </div>
    </> : <div className="empty-state"><MapPin aria-hidden="true" /><h2>No shelves yet</h2><p>This library has not published any shelves with physical copies.</p></div>}
  </section>;
}
