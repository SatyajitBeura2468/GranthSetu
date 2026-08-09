import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className={`brand${compact ? " brand-compact" : ""}`} href={href} aria-label="GranthSetu home"><BrandMark /><span>GranthSetu</span></Link>;
}
