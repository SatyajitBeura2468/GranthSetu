import { Search } from "lucide-react";

export function CatalogueSearch({ code, defaultValue = "", available = false, shelf }: { code: string; defaultValue?: string; available?: boolean; shelf?: string }) {
  return <form className="catalogue-search" action={`/l/${code}/catalogue`}><Search aria-hidden="true" /><label className="sr-only" htmlFor="catalogue-query">Search this library</label><input id="catalogue-query" name="q" defaultValue={defaultValue} placeholder="Search by title, author, ISBN, category or shelf" />{available ? <input type="hidden" name="available" value="1" /> : null}{shelf ? <input type="hidden" name="shelf" value={shelf} /> : null}<button className="button button-primary" type="submit">Search</button></form>;
}
