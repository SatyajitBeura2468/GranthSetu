import { Filter, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

export function OperatorToolbar({ query, addLabel, children }: { query?: string; addLabel?: string; children?: ReactNode }) {
  return <div className="operator-toolbar"><form><label className="search-control"><Search aria-hidden="true" /><input name="q" defaultValue={query} placeholder="Search this view" /></label><button className="button button-small button-secondary" type="submit"><Filter aria-hidden="true" />Filter</button></form>{addLabel ? <details className="create-popover"><summary className="button button-primary"><Plus aria-hidden="true" />{addLabel}</summary><div>{children}</div></details> : null}</div>;
}

export function TableState({ error, empty, children }: { error?: string; empty: string; children: ReactNode }) {
  if (error) return <div className="empty-state empty-state-error"><h2>Unable to read this data</h2><p>{error}</p></div>;
  return children ? <>{children}</> : <div className="empty-state"><h2>{empty}</h2><p>Use the primary action to add the first record.</p></div>;
}
