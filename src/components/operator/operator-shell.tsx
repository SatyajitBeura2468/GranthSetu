"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookCopy, BookOpen, ChevronDown, Gauge, History, LogOut, Menu, Repeat2, Search, Settings, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { logoutAction } from "@/app/operator/actions";
import { Brand } from "@/components/brand/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { AccessibleLibrary, LibraryOperatorContext } from "@/lib/auth/types";

const primary = [
  ["", "Dashboard", Gauge], ["circulation", "Circulation", Repeat2], ["catalogue", "Catalogue", BookOpen],
  ["inventory", "Inventory", BookCopy], ["members", "Members", Users], ["reports", "Reports", BarChart3],
] as const;
const admin = [["settings", "Settings", Settings], ["admin/operators", "Operators", UserCog], ["admin/audit", "Audit", History]] as const;

function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function OperatorShell({ context, libraries, children }: { context: LibraryOperatorContext; libraries: AccessibleLibrary[]; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [open, setOpen] = useState(false); const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null); const searchTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null); const menuTrigger = useRef<HTMLButtonElement>(null);
  const searchWasOpen = useRef(false); const menuWasOpen = useRef(false);
  const root = `/operator/${context.libraryCode}`;
  const nav = (items: typeof primary | typeof admin) => items.map(([path, label, Icon]) => {
    const href = `${root}${path ? `/${path}` : ""}`; const active = path ? pathname.startsWith(href) : pathname === root;
    return <Link key={path} href={href} className={active ? "is-active" : ""} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span>{label}</span></Link>;
  });

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setOpen(false); }
    };
    window.addEventListener("keydown", handleShortcut); return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => {
    if (searchOpen) {
      searchWasOpen.current = true;
      queueMicrotask(() => searchInput.current?.focus());
    } else if (searchWasOpen.current) {
      searchWasOpen.current = false;
      searchTrigger.current?.focus();
    }
  }, [searchOpen]);
  useEffect(() => {
    if (!searchOpen) return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    body.dataset.overlayOpen = "true";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      delete body.dataset.overlayOpen;
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [searchOpen]);
  useEffect(() => {
    if (open) {
      menuWasOpen.current = true;
      queueMicrotask(() => sidebar.current?.querySelector<HTMLElement>("a,button,select")?.focus());
    } else if (menuWasOpen.current) {
      menuWasOpen.current = false;
      menuTrigger.current?.focus();
    }
  }, [open]);

  return <div className="operator-shell-v3">
    <header className="operator-mobile-bar"><button ref={menuTrigger} type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu aria-hidden="true" /></button><Brand href={root} compact /><span>{pathname.split("/").at(-1)?.replaceAll("-", " ")}</span></header>
    <aside ref={sidebar} onKeyDown={open ? trapFocus : undefined} className={open ? "operator-sidebar is-open" : "operator-sidebar"} aria-label="Operator navigation">
      <div className="sidebar-brand"><Brand href={root} /><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X aria-hidden="true" /></button></div>
      <div className="sidebar-library"><span><ShieldCheck aria-hidden="true" /></span><div><label className="sr-only" htmlFor="room-switcher">Current Library Room</label><select id="room-switcher" value={context.libraryCode} onChange={(event) => router.push(`/operator/${event.target.value}`)}>{libraries.map((library) => <option key={library.libraryId} value={library.libraryCode}>{library.libraryName}</option>)}</select><small>{context.libraryCode}{libraries.length > 1 ? ` · ${libraries.length} rooms` : ""}</small></div></div>
      <nav>{nav(primary)}{context.roles.includes("administrator") ? <><p>Administration</p>{nav(admin)}</> : null}</nav>
      <div className="sidebar-bottom"><ThemeToggle /><Link href={`/l/${context.libraryCode}`}><BookOpen aria-hidden="true" />Public library</Link><div className="operator-identity"><span>{context.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{context.displayName}</strong><small>{context.roles.join(" · ")}</small></div><ChevronDown aria-hidden="true" /></div><form action={logoutAction}><button type="submit"><LogOut aria-hidden="true" />Log out</button></form></div>
    </aside>
    {open ? <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
    <div className="operator-workspace"><header className="operator-commandbar"><button ref={searchTrigger} type="button" aria-label="Global search" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" /><span>Search books, copies, members, loans…</span><kbd>Ctrl K</kbd></button><div><span>{context.libraryCode}</span><strong>{context.libraryName}</strong></div></header>{context.demo ? <p className="demo-notice operator-demo">Local demonstration workspace · Mutations are disabled</p> : null}<main>{children}</main></div>
    {searchOpen ? <div className="command-dialog-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}><section onKeyDown={trapFocus} className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title" onMouseDown={(event) => event.stopPropagation()}><header><div><Search aria-hidden="true" /><h2 id="global-search-title">Search this Library Room</h2></div><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close global search"><X aria-hidden="true" /></button></header><form action={`${root}/search`}><label className="sr-only" htmlFor="operator-global-search">Search books, copies, members, and loans</label><input ref={searchInput} id="operator-global-search" name="q" minLength={2} required placeholder="Title, author, accession, barcode, member…" autoComplete="off" /><button className="button button-primary" type="submit">Search</button></form><p>Results never leave <strong>{context.libraryName}</strong>.</p></section></div> : null}
  </div>;
}
