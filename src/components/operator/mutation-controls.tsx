"use client";

import { useMemo } from "react";
import { useFormStatus } from "react-dom";

export function MutationRequestId() {
  const requestId = useMemo(() => typeof window === "undefined" ? "" : crypto.randomUUID(), []);
  return <input type="hidden" name="requestId" value={requestId} readOnly />;
}

export function MutationSubmitButton({ idleLabel, pendingLabel = "Saving…", className = "button button-primary", disabled = false }: {
  idleLabel: string; pendingLabel?: string; className?: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const ready = typeof window !== "undefined";
  return <button className={className} type="submit" disabled={disabled || pending || !ready} aria-disabled={disabled || pending || !ready}>{pending ? pendingLabel : idleLabel}</button>;
}
