"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn, Menu, Search } from "lucide-react";
import { Brand } from "@/components/brand/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { PublicLibrary } from "@/lib/library/public-data";

export function PublicMasthead({ library }: { library: PublicLibrary }) {
  const pathname = usePathname(); const search = useSearchParams();
  const current = pathname.endsWith("/catalogue") ? (search.get("available") === "1" ? "available" : "catalogue") : "home";
  return <header className="public-masthead"><div className="public-brand"><Brand href={`/l/${library.code}`} compact /><span>{library.displayName}</span></div><nav aria-label="Public library"><Link className={current === "home" ? "is-active" : ""} href={`/l/${library.code}`}><Search aria-hidden="true" />Search</Link><Link className={current === "catalogue" ? "is-active" : ""} href={`/l/${library.code}/catalogue`}>Catalogue</Link><Link className={current === "available" ? "is-active" : ""} href={`/l/${library.code}/catalogue?available=1`}>Available now</Link></nav><div className="public-actions"><ThemeToggle compact /><Link className="button button-small button-secondary" href={`/l/${library.code}/login`}><LogIn aria-hidden="true" />Staff sign in</Link><Link className="button button-small button-quiet" href="/">Switch library</Link></div><details className="mobile-public-menu"><summary><Menu aria-hidden="true" />Menu</summary><div><Link aria-current={current === "home" ? "page" : undefined} href={`/l/${library.code}`}>Search</Link><Link aria-current={current === "catalogue" ? "page" : undefined} href={`/l/${library.code}/catalogue`}>Catalogue</Link><Link aria-current={current === "available" ? "page" : undefined} href={`/l/${library.code}/catalogue?available=1`}>Available now</Link><Link href={`/l/${library.code}/login`}>Staff sign in</Link><Link href="/">Switch library</Link><ThemeToggle compact /></div></details></header>;
}
