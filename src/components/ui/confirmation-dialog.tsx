"use client";

import { AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const focusableSelector = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function ConfirmationDialog({ open, title, description, confirmLabel, onCancel, onConfirm }: ConfirmationDialogProps) {
  const [closing, setClosing] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    body.dataset.overlayOpen = "true";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-confirm-action]")?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      delete body.dataset.overlayOpen;
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  function cancel() {
    if (closing) return;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140;
    closeTimer.current = window.setTimeout(() => {
      setClosing(false);
      closeTimer.current = null;
      onCancel();
    }, delay);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!mounted || !open) return null;
  return createPortal(<div className={`confirmation-layer${closing ? " is-closing" : ""}`}>
    <button className="confirmation-backdrop" type="button" aria-label="Cancel confirmation" onClick={cancel} />
    <section ref={panelRef} className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handleKeyDown}>
      <button className="confirmation-close" type="button" aria-label={`Close ${title}`} onClick={cancel}><X aria-hidden="true" /></button>
      <span className="confirmation-icon"><AlertTriangle aria-hidden="true" /></span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className="confirmation-actions">
        <button type="button" className="button button-secondary" onClick={cancel}>Cancel</button>
        <button type="button" className="button confirmation-confirm" data-confirm-action onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>, document.body);
}
