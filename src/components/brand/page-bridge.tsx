export function PageBridge({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 760 170" fill="none" aria-hidden="true">
      <path d="M24 124c120-56 238-56 356 0 118-56 236-56 356 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 142c120-42 238-42 356 0 118-42 236-42 356 0M24 158c120-28 238-28 356 0 118-28 236-28 356 0" stroke="currentColor" strokeOpacity=".48" />
      <path d="M186 116c38-66 88-66 126 0M448 116c38-66 88-66 126 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M199 101v30M299 101v30M461 101v30M561 101v30" stroke="currentColor" strokeOpacity=".7" />
      <path d="M380 124V36" stroke="var(--accent)" strokeWidth="1.5" /><path d="M367 48h26l-13-13-13 13Z" fill="var(--accent)" />
    </svg>
  );
}
