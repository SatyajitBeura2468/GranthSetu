export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`brand-mark ${className}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4.5C12.82 4.5 7 10.32 7 17.5S12.82 30.5 20 30.5c4.42 0 8.33-2.2 10.68-5.57" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20 13h13v15.5M20 19h9.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 34c4.35-5.2 9.52-7.8 15.5-7.8S31.15 28.8 35.5 34" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 34v-4.25M31.5 34v-4.25M12 31.2v2.8M28 31.2V34" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
