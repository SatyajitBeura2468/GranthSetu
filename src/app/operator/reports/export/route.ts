import { NextResponse } from "next/server";
import { assertOperator } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reports: Record<string, string> = { circulation: "report_circulation", overdue: "report_overdue", popular: "report_popular_books", members: "report_member_activity", inventory: "report_inventory", fines: "report_fines" };
function csvCell(value: unknown) { const raw = String(value ?? ""); const safe = /^[\u0000-\u0020]*[=+@-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export async function GET(request: Request) { await assertOperator(); const kind = new URL(request.url).searchParams.get("kind") ?? "circulation"; const rpcName = reports[kind] ?? reports.circulation; const rpc = asOperatorRpcClient(await createSupabaseServerClient()); const { data, error } = await rpc.rpc(rpcName); if (error) return NextResponse.json({ error: "Report unavailable" }, { status: 400 }); const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : []; const columns = rows.length ? Object.keys(rows[0]) : []; const body = [columns, ...rows.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvCell).join(",")).join("\r\n"); return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="granthsetu-${kind}.csv"`, "cache-control": "no-store" } }); }
