"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

type DrawerProps = {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  description?: string;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  initiallyOpen?: boolean;
};

const focusableSelector = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  trigger,
  title,
  children,
  description,
  triggerClassName = "button button-primary",
  triggerAriaLabel,
  initiallyOpen = false,
}: DrawerProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [closing, setClosing] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    body.dataset.overlayOpen = "true";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const focusTimer = window.setTimeout(() => {
      const firstTarget = panelRef.current?.querySelector<HTMLElement>("[data-drawer-autofocus]")
        ?? panelRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? panelRef.current?.querySelector<HTMLElement>(focusableSelector)
        ?? panelRef.current;
      firstTarget?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      delete body.dataset.overlayOpen;
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  function close() {
    if (closing || !open) return;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, delay);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (!focusable.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
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

  return <>
    <button
      type="button"
      className={triggerClassName}
      aria-label={triggerAriaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
        setClosing(false);
        setOpen(true);
      }}
    >
      {trigger}
    </button>
    {mounted && open ? createPortal(
      <div className={`drawer-layer${closing ? " is-closing" : ""}`}>
        <div className="drawer-backdrop" aria-hidden="true" onMouseDown={close} />
        <aside
          ref={panelRef}
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          <header className="drawer-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <button type="button" className="drawer-close" onClick={close} aria-label={`Close ${title}`}>
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="drawer-content">{children}</div>
        </aside>
      </div>,
      document.body,
    ) : null}
  </>;
}
