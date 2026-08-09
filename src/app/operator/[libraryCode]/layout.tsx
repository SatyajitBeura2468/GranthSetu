import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OperatorShell } from "@/components/operator/operator-shell";
import { requireLibraryOperator } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Operator workspace", robots: { index: false, follow: false } };

export default async function LibraryOperatorLayout({ children, params }: { children: ReactNode; params: Promise<{ libraryCode: string }> }) {
  const context = await requireLibraryOperator((await params).libraryCode);
  return <OperatorShell context={context}>{children}</OperatorShell>;
}
