import Link from "next/link";
import type { ReactNode } from "react";
import { requireOperator } from "@/lib/auth/authorization";
import { LogoutButton } from "@/app/operator/logout-button";

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const context = await requireOperator();
  return (
    <div className="operator-shell">
      <header className="operator-header">
        <div><Link className="auth-brand" href="/operator">GranthSetu</Link><span className="operator-label">Operator workspace</span></div>
        <div className="operator-header-actions"><span className="operator-user">{context.displayName}</span><LogoutButton /></div>
      </header>
      <main className="operator-main">{children}</main>
    </div>
  );
}
