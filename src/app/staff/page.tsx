import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand/brand";
import { PageBridge } from "@/components/brand/page-bridge";
import { LibraryCodeForm } from "@/components/library/library-code-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = { title: "Staff access", robots: { index: false, follow: false } };

export default function StaffPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div><h1>Open your staff workspace.</h1><p>Start with the Library Code. Your credentials and role are verified for that room in the next step.</p></div><PageBridge /></section><section className="auth-panel"><div className="auth-panel-top"><Link href="/">Back to GranthSetu</Link><ThemeToggle compact /></div><div className="auth-card"><p className="step-label">Step 1 of 2</p><h2>Find your Library Room</h2><p>Library Codes are public room locators. They never grant staff access by themselves.</p><LibraryCodeForm action="staff" submitLabel="Continue" /></div></section></main>;
}
