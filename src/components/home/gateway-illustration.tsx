"use client";

import { useEffect, useRef } from "react";

export function GatewayIllustration() {
  const artworkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const artwork = artworkRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!artwork || !finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    const update = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = ((event.clientX / window.innerWidth) - 0.5) * 6;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 4;
        artwork.style.setProperty("--gateway-parallax-x", `${x.toFixed(2)}px`);
        artwork.style.setProperty("--gateway-parallax-y", `${y.toFixed(2)}px`);
      });
    };

    window.addEventListener("pointermove", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", update);
    };
  }, []);

  return (
    <div ref={artworkRef} className="gateway-illustration" aria-hidden="true">
      <span className="gateway-illustration-halo" />
      <svg viewBox="0 0 720 420" fill="none">
        <g className="gateway-network">
          <path d="M72 164C180 120 262 158 352 246C446 154 536 112 650 158" />
          <path d="M96 214C194 176 268 200 352 282C440 196 514 172 624 208" />
          <path d="M138 104C226 82 286 126 352 206C418 122 490 82 586 104" />
          <path d="M352 306V72" className="gateway-axis" />
          <path d="M341 88L352 72L363 88" className="gateway-axis" />
          <circle cx="72" cy="164" r="4" /><circle cx="138" cy="104" r="4" /><circle cx="96" cy="214" r="4" />
          <circle cx="650" cy="158" r="4" /><circle cx="586" cy="104" r="4" /><circle cx="624" cy="208" r="4" />
          <circle cx="256" cy="148" r="3" /><circle cx="466" cy="142" r="3" /><circle cx="222" cy="222" r="3" /><circle cx="502" cy="218" r="3" />
        </g>
        <g className="gateway-book-bridge">
          <path d="M52 330C154 292 252 292 352 344C452 292 550 292 668 330" />
          <path d="M52 350C160 320 256 320 352 364C448 320 544 320 668 350" />
          <path d="M52 370C162 346 258 346 352 384C446 346 542 346 668 370" />
          <path d="M142 328C192 236 260 236 312 328M392 328C446 236 516 236 568 328" className="gateway-bridge-arch" />
          <path d="M166 296V340M286 296V340M418 296V340M542 296V340" />
          <path d="M352 344V394" />
        </g>
        <g className="gateway-discovery-star">
          <path d="M352 44V58M352 20V34M330 46H344M360 46H374" />
          <path d="M352 34L356 42L364 46L356 50L352 58L348 50L340 46L348 42L352 34Z" />
        </g>
      </svg>
    </div>
  );
}
