"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";

export function MutationRequestId() {
  const requestId = stableRequestId(useId());
  return <input type="hidden" name="requestId" value={requestId} readOnly />;
}

export function stableRequestId(seed: string) {
  let a = 0x811c9dc5; let b = 0x9e3779b9; let c = 0x85ebca6b; let d = 0xc2b2ae35;
  for (let index = 0; index < seed.length; index += 1) { const code = seed.charCodeAt(index); a = Math.imul(a ^ code, 0x01000193); b = Math.imul(b ^ code, 0x85ebca6b); c = Math.imul(c ^ code, 0xc2b2ae35); d = Math.imul(d ^ code, 0x27d4eb2d); }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  const raw = `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`.slice(0, 32).split(""); raw[12] = "4"; raw[16] = "89ab"[Number.parseInt(raw[16], 16) % 4];
  return `${raw.slice(0, 8).join("")}-${raw.slice(8, 12).join("")}-${raw.slice(12, 16).join("")}-${raw.slice(16, 20).join("")}-${raw.slice(20, 32).join("")}`;
}

export function MutationSubmitButton({ idleLabel, pendingLabel = "Saving…", className = "button button-primary", disabled = false }: {
  idleLabel: string; pendingLabel?: string; className?: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>{pending ? pendingLabel : idleLabel}</button>;
}
