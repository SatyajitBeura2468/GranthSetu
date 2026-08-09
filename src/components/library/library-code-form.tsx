"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";

export function LibraryCodeForm({ initialCode = "", submitLabel = "Enter library", action = "public" }: { initialCode?: string; submitLabel?: string; action?: "public" | "staff" }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeLibraryCode(initialCode));
  const [touched, setTouched] = useState(false);
  const valid = validLibraryCode(code);
  return (
    <form className="library-code-form" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!valid) return; router.push(action === "staff" ? `/l/${code}/login` : `/l/${code}`); }} noValidate>
      <label htmlFor={`library-code-${action}`}>Library Code</label>
      <div className="code-input-wrap">
        <input id={`library-code-${action}`} name="libraryCode" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16} value={code} onChange={(event) => setCode(normalizeLibraryCode(event.target.value))} onBlur={() => setTouched(true)} placeholder="e.g. OAVMUSI" aria-describedby={`library-code-help-${action}`} aria-invalid={touched && !valid} />
        <span>{code.length}/16</span>
      </div>
      <p id={`library-code-help-${action}`} className={touched && !valid ? "field-error" : "field-help"}>{touched && !valid ? "Use 5–16 letters, numbers, or internal hyphens." : "The code is shared by your institution. It is not a password."}</p>
      <button className="button button-primary button-full" type="submit">{submitLabel}<ArrowRight aria-hidden="true" /></button>
    </form>
  );
}
