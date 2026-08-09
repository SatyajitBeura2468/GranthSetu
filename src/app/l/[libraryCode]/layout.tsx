import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PublicMasthead } from "@/components/public/public-masthead";
import { RememberLibrary } from "@/components/library/remember-library";
import { getPublicLibrary } from "@/lib/library/public-data";
import Link from "next/link";

export default async function LibraryRoomLayout({ children, params }: { children: ReactNode; params: Promise<{ libraryCode: string }> }) {
  const { libraryCode } = await params;
  const library = await getPublicLibrary(libraryCode);
  if (!library) notFound();
  return <div className="public-shell"><RememberLibrary code={library.code} name={library.displayName} /><PublicMasthead library={library} /><main className="public-main">{library.demo ? <p className="demo-notice" role="status">Local demonstration catalogue · No real member or circulation data</p> : null}{children}</main><footer className="public-footer"><span>GranthSetu</span><span>{library.displayName}</span><LinkFooter /></footer></div>;
}

function LinkFooter() { return <Link href="/">Switch library</Link>; }
