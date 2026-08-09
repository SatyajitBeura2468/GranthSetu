"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Remembered = { code: string; name: string };

export function RememberedLibrary() {
  const [library, setLibrary] = useState<Remembered | null>(null);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("granthsetu-library") ?? "null") as Remembered | null;
      if (parsed?.code && parsed?.name) queueMicrotask(() => setLibrary(parsed));
    } catch { localStorage.removeItem("granthsetu-library"); }
  }, []);
  if (!library) return null;
  return <div className="remembered-library"><span>Recently visited</span><Link href={`/l/${encodeURIComponent(library.code)}`}>Continue to {library.name}</Link></div>;
}
