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
          <path d="M72 164C178 120 272 158 360 246C448 158 542 120 648 164" />
          <path d="M96 214C194 176 278 200 360 282C442 200 526 176 624 214" />
          <path d="M138 104C228 82 294 126 360 206C426 126 492 82 582 104" />
          <path d="M360 306V72" className="gateway-axis" />
          <path d="M349 88L360 72L371 88" className="gateway-axis" />
          <circle cx="72" cy="164" r="4" /><circle cx="138" cy="104" r="4" /><circle cx="96" cy="214" r="4" />
          <circle cx="648" cy="164" r="4" /><circle cx="582" cy="104" r="4" /><circle cx="624" cy="214" r="4" />
          <circle cx="256" cy="148" r="3" /><circle cx="464" cy="148" r="3" /><circle cx="222" cy="222" r="3" /><circle cx="498" cy="222" r="3" />
        </g>
        <g className="gateway-book-bridge">
          <path d="M52 330C154 292 260 292 360 344C460 292 566 292 668 330" />
          <path d="M52 350C160 320 262 320 360 364C458 320 560 320 668 350" />
          <path d="M52 370C162 346 264 346 360 384C456 346 558 346 668 370" />
          <path d="M142 328C194 236 266 236 320 328M400 328C454 236 526 236 578 328" className="gateway-bridge-arch" />
          <path d="M166 296V340M286 296V340M434 296V340M554 296V340" />
          <path d="M360 344V394" />
        </g>
        <g className="gateway-discovery-star">
          <path d="M360 44V58M360 20V34M338 46H352M368 46H382" />
          <path d="M360 34L364 42L372 46L364 50L360 58L356 50L348 46L356 42L360 34Z" />
        </g>
      </svg>
    </div>
  );
}
