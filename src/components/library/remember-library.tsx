"use client";

import { useEffect } from "react";

export function RememberLibrary({ code, name }: { code: string; name: string }) {
  useEffect(() => { localStorage.setItem("granthsetu-library", JSON.stringify({ code, name })); }, [code, name]);
  return null;
}
