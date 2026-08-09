"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookCopy, BookOpen, ChevronDown, Gauge, History, LogOut, Menu, Repeat2, Search, Settings, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { logoutAction } from "@/app/operator/actions";
import { Brand } from "@/components/brand/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { LibraryOperatorContext } from "@/lib/auth/types";

const primary = [
  ["", "Dashboard", Gauge], ["circulation", "Circulation", Repeat2], ["catalogue", "Catalogue", BookOpen],
  ["inventory", "Inventory", BookCopy], ["members", "Members", Users], ["reports", "Reports", BarChart3],
] as const;
const admin = [["settings", "Settings", Settings], ["admin/operators", "Operators", UserCog], ["admin/audit", "Audit", History]] as const;

export function OperatorShell({ context, children }: { context: LibraryOperatorContext; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const root = `/operator/${context.libraryCode}`;
  const nav = (items: typeof primary | typeof admin) => items.map(([path, label, Icon]) => {
    const href = `${root}${path ? `/${path}` : ""}`;
    const active = path ? pathname.startsWith(href) : pathname === root;
    return <Link key={path} href={href} className={active ? "is-active" : ""} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span>{label}</span></Link>;
  });
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => {
    if (searchOpen) queueMicrotask(() => searchInput.current?.focus());
  }, [searchOpen]);
  return <div className="operator-shell-v3">
    <header className="operator-mobile-bar"><button type="button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu aria-hidden="true" /></button><Brand href={root} compact /><span>{pathname.split("/").at(-1)?.replaceAll("-", " ")}</span></header>
    <aside className={open ? "operator-sidebar is-open" : "operator-sidebar"} aria-label="Operator navigation">
      <div className="sidebar-brand"><Brand href={root} /><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X aria-hidden="true" /></button></div>
      <div className="sidebar-library"><span><ShieldCheck aria-hidden="true" /></span><div><strong>{context.libraryName}</strong><small>{context.libraryCode}</small></div></div>
      <nav>{nav(primary)}{context.roles.includes("administrator") ? <><p>Administration</p>{nav(admin)}</> : null}</nav>
      <div className="sidebar-bottom"><ThemeToggle /><Link href={`/l/${context.libraryCode}`}><BookOpen aria-hidden="true" />Public library</Link><div className="operator-identity"><span>{context.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{context.displayName}</strong><small>{context.roles.join(" · ")}</small></div><ChevronDown aria-hidden="true" /></div><form action={logoutAction}><button type="submit"><LogOut aria-hidden="true" />Log out</button></form></div>
    </aside>
    {open ? <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
    <div className="operator-workspace"><header className="operator-commandbar"><button type="button" aria-label="Global search" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" /><span>Search books, copies, members, loans…</span><kbd>Ctrl K</kbd></button><div><span>{context.libraryCode}</span><strong>{context.displayName}</strong></div></header>{context.demo ? <p className="demo-notice operator-demo">Local demonstration workspace · Mutations are disabled</p> : null}<main>{children}</main></div>
    {searchOpen ? <div className="command-dialog-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}><section className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title" onMouseDown={(event) => event.stopPropagation()}><header><div><Search aria-hidden="true" /><h2 id="global-search-title">Search this Library Room</h2></div><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close global search"><X aria-hidden="true" /></button></header><form action={`${root}/search`}><label className="sr-only" htmlFor="operator-global-search">Search books, copies, members, and loans</label><input ref={searchInput} id="operator-global-search" name="q" minLength={2} required placeholder="Title, author, accession, barcode, member…" autoComplete="off" /><button className="button button-primary" type="submit">Search</button></form><p>Results never leave <strong>{context.libraryName}</strong>.</p></section></div> : null}
  </div>;
}
