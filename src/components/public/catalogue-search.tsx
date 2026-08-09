import { Search } from "lucide-react";

export function CatalogueSearch({ code, defaultValue = "", available = false }: { code: string; defaultValue?: string; available?: boolean }) {
  return <form className="catalogue-search" action={`/l/${code}/catalogue`}><Search aria-hidden="true" /><label className="sr-only" htmlFor="catalogue-query">Search this library</label><input id="catalogue-query" name="q" defaultValue={defaultValue} placeholder="Search by title, author, ISBN or category" />{available ? <input type="hidden" name="available" value="1" /> : null}<button className="button button-primary" type="submit">Search</button></form>;
}
