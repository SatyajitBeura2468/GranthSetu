import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand/brand";
import { PageBridge } from "@/components/brand/page-bridge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { getPublicLibrary } from "@/lib/library/public-data";
import { RoomLoginForm } from "./room-login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default async function RoomLoginPage({ params }: { params: Promise<{ libraryCode: string }> }) {
  const library = await getPublicLibrary((await params).libraryCode); if (!library) return null;
  return <main className="auth-shell"><section className="auth-visual"><Brand href={`/l/${library.code}`} /><div><p>{library.displayName}</p><h1>The library, ready for work.</h1><span>Your permissions are determined by your active role in this Library Room.</span></div><PageBridge /></section><section className="auth-panel"><div className="auth-panel-top"><Link href={`/l/${library.code}`}>Back to public library</Link><ThemeToggle compact /></div><div className="auth-card"><p className="step-label">Step 2 of 2</p><h2>Staff sign in</h2><p>Continue to the operator workspace for <strong>{library.displayName}</strong>.</p><RoomLoginForm code={library.code} configured={Boolean(getOptionalPublicSupabaseEnv())} /><div className="auth-card-footer"><Link href="/forgot-password">Forgot password?</Link><Link href="/staff">Use another Library Code</Link></div></div></section></main>;
}
