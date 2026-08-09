import "server-only";

import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { normalizeLibraryCode } from "@/lib/library/code";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

export type WorkspaceData = Record<string, unknown> & { error?: string; demo?: boolean };

const demo: Record<string, WorkspaceData> = {
  dashboard: { demo: true, metrics: { activeLoans: 128, overdueLoans: 7, availableCopies: 842, activeMembers: 614, finesOutstandingMinor: 245000, totalBooks: 526 }, attention: [{ label: "7 loans are overdue", detail: "Oldest due date was 6 Aug", tone: "danger" }, { label: "4 copies need condition review", detail: "Maintenance or damaged state", tone: "warning" }, { label: "No unresolved data failures", detail: "All demo reads completed", tone: "success" }], activity: [{ time: "10:32", action: "Return", member: "K. Sushmita", item: "Wings of Fire · C-1847" }, { time: "10:15", action: "Issue", member: "R. Harshavardhan", item: "The Discovery of India · C-2713" }, { time: "09:58", action: "Renew", member: "B. Lavanya", item: "A Brief History of Time · C-1250" }] },
  circulation: { demo: true, members: [{ id: "m1", name: "R. Harshavardhan", identifier: "M-0978", context: "Class XI · Valid through Mar 2027", activeLoans: 2, overdueLoans: 0 }, { id: "m2", name: "K. Sushmita", identifier: "M-1042", context: "Class X · Roll 18", activeLoans: 1, overdueLoans: 1 }], copies: [{ id: "c1", title: "The Discovery of India", author: "Jawaharlal Nehru", accession: "C-2713", location: "History · H-04", state: "Available" }, { id: "c2", title: "Wings of Fire", author: "A. P. J. Abdul Kalam", accession: "C-1847", location: "Biography · B-02", state: "Available" }], loans: [{ id: "l1", member: "K. Sushmita", identifier: "M-1042", title: "A Brief History of Time", accession: "C-1250", due: "2026-08-06", overdue: true }, { id: "l2", member: "B. Lavanya", identifier: "M-0881", title: "The God of Small Things", accession: "C-1802", due: "2026-08-21", overdue: false }] },
  catalogue: { demo: true, books: [{ id: "b1", title: "Wings of Fire", author: "A. P. J. Abdul Kalam", isbn: "9788173711466", available: 3, total: 5, status: "Active" }, { id: "b2", title: "The Discovery of India", author: "Jawaharlal Nehru", isbn: "9780143031031", available: 1, total: 4, status: "Active" }, { id: "b3", title: "A Brief History of Time", author: "Stephen Hawking", isbn: "9780553380163", available: 0, total: 4, status: "Active" }, { id: "b4", title: "India After Gandhi", author: "Ramachandra Guha", isbn: "9780330505543", available: 0, total: 2, status: "Active" }] },
  inventory: { demo: true, copies: [{ id: "c1", accession: "C-2713", title: "The Discovery of India", location: "History · H-04", condition: "Good", state: "Available" }, { id: "c2", accession: "C-1847", title: "Wings of Fire", location: "Biography · B-02", condition: "Good", state: "On loan" }, { id: "c3", accession: "C-1250", title: "A Brief History of Time", location: "Science · S-11", condition: "Fair", state: "On loan" }, { id: "c4", accession: "C-0912", title: "India After Gandhi", location: "History · H-02", condition: "Poor", state: "Maintenance" }] },
  members: { demo: true, members: [{ id: "m1", name: "R. Harshavardhan", identifier: "M-0978", kind: "Student", context: "Class XI · Section A · Roll 26", activeLoans: 2, status: "Active" }, { id: "m2", name: "K. Sushmita", identifier: "M-1042", kind: "Student", context: "Class X · Section B · Roll 18", activeLoans: 1, status: "Active" }, { id: "m3", name: "P. Rakesh", identifier: "M-1123", kind: "Teacher", context: "Faculty", activeLoans: 0, status: "Active" }] },
  reports: { demo: true, summary: { issues: 124, returns: 110, overdue: 7, activeMembers: 614 }, circulation: [32, 46, 41, 63, 58, 76, 69, 82, 71, 91, 84, 102], categories: [{ label: "Fiction", value: 34 }, { label: "Science", value: 26 }, { label: "History", value: 18 }, { label: "Biography", value: 12 }, { label: "Other", value: 10 }], popular: [{ title: "Wings of Fire", author: "A. P. J. Abdul Kalam", loans: 48 }, { title: "The Discovery of India", author: "Jawaharlal Nehru", loans: 42 }, { title: "A Brief History of Time", author: "Stephen Hawking", loans: 38 }] },
  search: { demo: true, results: [{ result_type: "book", result_id: "b1", title: "Wings of Fire", subtitle: "A. P. J. Abdul Kalam" }, { result_type: "copy", result_id: "c1", title: "The Discovery of India", subtitle: "C-2713" }, { result_type: "member", result_id: "m1", title: "R. Harshavardhan", subtitle: "M-0978" }] },
  settings: { demo: true, settings: [{ key: "default_loan_period_days", label: "Default loan period", value: "14 days" }, { key: "checkout_limit", label: "Checkout limit", value: "5 items" }, { key: "renewal_limit", label: "Renewal limit", value: "2 renewals" }, { key: "fines_enabled", label: "Fines", value: "Disabled" }] },
  operators: { demo: true, operators: [{ id: "o1", name: "S. Madhavi", role: "Administrator", status: "Active" }, { id: "o2", name: "A. Mishra", role: "Librarian", status: "Active" }] },
  audit: { demo: true, events: [{ time: "10:32:18", actor: "S. Madhavi", action: "circulation.loan_returned", entity: "Loan", target: "Wings of Fire · C-1847", result: "Success" }, { time: "10:15:04", actor: "S. Madhavi", action: "circulation.loan_issued", entity: "Loan", target: "The Discovery of India · C-2713", result: "Success" }, { time: "09:41:52", actor: "A. Mishra", action: "catalogue.book_updated", entity: "Book", target: "India After Gandhi", result: "Success" }] },
};

export async function getWorkspaceData(rawCode: string, resource: keyof typeof demo, query = "", id?: string): Promise<WorkspaceData> {
  const code = normalizeLibraryCode(rawCode);
  if (process.env.NODE_ENV === "development" && !getOptionalPublicSupabaseEnv() && code === "OAVMUSI") {
    const payload = demo[resource];
    const needle = query.trim().toLowerCase();
    if (!needle) return payload;
    const listKey = resource === "catalogue" ? "books" : resource === "inventory" ? "copies" : resource === "members" ? "members" : resource === "search" ? "results" : null;
    if (!listKey) return payload;
    const rows = (payload[listKey] ?? []) as Array<Record<string, unknown>>;
    return { ...payload, [listKey]: rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle))) };
  }
  if (!getOptionalPublicSupabaseEnv()) return { error: "The authoritative data service is not configured." };
  const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_data", { p_library_code: code, p_resource: resource, p_query: query || null, p_id: id ?? null });
  if (error || !data) return { error: "Authoritative workspace data could not be read." };
  return data as WorkspaceData;
}
