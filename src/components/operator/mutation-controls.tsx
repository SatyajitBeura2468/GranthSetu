"use client";

import { useMemo } from "react";
import { useFormStatus } from "react-dom";

export function MutationRequestId() {
  const requestId = useMemo(() => typeof window === "undefined" ? "" : crypto.randomUUID(), []);
  return <input type="hidden" name="requestId" value={requestId} readOnly />;
}

export function MutationSubmitButton({ idleLabel, pendingLabel = "Saving…", className = "button button-primary", disabled = false, name, value }: {
  idleLabel: string; pendingLabel?: string; className?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  const ready = typeof window !== "undefined";
  return <button className={className} type="submit" name={name} value={value} disabled={disabled || pending || !ready} aria-disabled={disabled || pending || !ready} aria-live="polite">{pending ? pendingLabel : idleLabel}</button>;
}
