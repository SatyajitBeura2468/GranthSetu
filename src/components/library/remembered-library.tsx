"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Remembered = { code: string; name: string };

export function RememberedLibrary() {
  const [library, setLibrary] = useState<Remembered | null>(null);
  useEffect(() => {
    let active = true;
    try {
      const parsed = JSON.parse(localStorage.getItem("granthsetu-library") ?? "null") as Remembered | null;
      if (parsed?.code && parsed?.name) {
        fetch(`/api/public/libraries/${encodeURIComponent(parsed.code)}`, { headers: { Accept: "application/json" } })
          .then(async (response) => response.ok ? response.json() as Promise<{ code: string; name: string }> : null)
          .then((verified) => {
            if (!active) return;
            if (verified?.code && verified?.name) setLibrary({ code: verified.code, name: verified.name });
            else localStorage.removeItem("granthsetu-library");
          }).catch(() => undefined);
      }
    } catch { localStorage.removeItem("granthsetu-library"); }
    return () => { active = false; };
  }, []);
  if (!library) return null;
  return <div className="remembered-library"><span>Recently visited</span><Link href={`/l/${encodeURIComponent(library.code)}`}>Continue to {library.name}</Link></div>;
}
