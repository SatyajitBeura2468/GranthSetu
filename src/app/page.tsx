import Link from "next/link";
import { ArrowRight, Building2, LogIn } from "lucide-react";
import { Brand } from "@/components/brand/brand";
import { LibraryCodeForm } from "@/components/library/library-code-form";
import { RememberedLibrary } from "@/components/library/remembered-library";
import { PageBridge } from "@/components/brand/page-bridge";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Home() {
  return (
    <main className="gateway-shell">
      <header className="gateway-topbar">
        <Brand />
        <ThemeToggle />
      </header>
      <section className="gateway-stage" aria-labelledby="gateway-title">
        <div className="gateway-copy">
          <h1 id="gateway-title">Your library,<br /><em>one code away.</em></h1>
          <p>Enter the code shared by your institution to open its Library Room. No student account is required.</p>
        </div>
        <div className="gateway-entry">
          <RememberedLibrary />
          <LibraryCodeForm />
          <div className="gateway-divider" aria-hidden="true"><span>or</span></div>
          <div className="gateway-utilities">
            <Link className="button button-secondary" href="/staff"><LogIn aria-hidden="true" />Staff sign in</Link>
            <Link className="button button-quiet" href="/create-library"><Building2 aria-hidden="true" />Create a library<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
      <PageBridge className="gateway-motif" />
      <footer className="gateway-footer"><span>© {new Date().getFullYear()} GranthSetu</span><span>One platform. Many private Library Rooms.</span></footer>
    </main>
  );
}
