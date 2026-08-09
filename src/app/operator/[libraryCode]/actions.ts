"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLibraryOperatorContext } from "@/lib/auth/authorization";
import { normalizeLibraryCode } from "@/lib/library/code";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

function value(form: FormData, key: string) { const result = String(form.get(key) ?? "").trim(); return result || null; }

export async function workspaceMutationAction(formData: FormData) {
  const libraryCode = normalizeLibraryCode(String(formData.get("libraryCode") ?? ""));
  const operation = String(formData.get("operation") ?? "");
  const context = await getLibraryOperatorContext(libraryCode);
  if (!context || context.demo) redirect(`/operator/${libraryCode}?error=${encodeURIComponent("This mutation is unavailable in the local demonstration workspace.")}`);
  const allowed = new Set(["issue", "renew", "return", "book_create", "copy_create", "member_create", "setting_update", "operator_assign"]);
  if (!allowed.has(operation)) redirect(`/operator/${libraryCode}?error=${encodeURIComponent("Unsupported operation.")}`);
  const payload: Record<string, string | null> = {};
  for (const key of ["memberId", "copyId", "loanId", "title", "author", "isbn", "bookId", "accession", "displayName", "memberKind", "settingKey", "settingValue", "email", "role", "notes"]) payload[key] = value(formData, key);
  const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", { p_library_code: libraryCode, p_operation: operation, p_payload: payload, p_request_id: randomUUID() });
  const section = operation === "issue" || operation === "renew" || operation === "return" ? "circulation" : operation.startsWith("book") ? "catalogue" : operation.startsWith("copy") ? "inventory" : operation.startsWith("member") ? "members" : operation.startsWith("setting") ? "settings" : "admin/operators";
  if (error) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("The operation was rejected. Check the selected room, record state, and your role.")}`);
  revalidatePath(`/operator/${libraryCode}`);
  redirect(`/operator/${libraryCode}/${section}?success=${encodeURIComponent("Saved successfully")}`);
}
