"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";
import { getLibraryOperatorContext } from "@/lib/auth/authorization";
import { normalizeLibraryCode } from "@/lib/library/code";
import { rpcErrorMessage, asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBookCoverUpload, removeBookCoverObject } from "@/lib/operator/cover-storage";

function value(form: FormData, key: string) { const result = String(form.get(key) ?? "").trim(); return result || null; }
function destination(operation: string) {
  if (["issue","renew","return","fine_settle","fine_waive"].includes(operation)) return "circulation";
  if (operation.startsWith("book")) return "catalogue";
  if (operation.startsWith("copy")) return "inventory";
  if (operation.startsWith("member")) return "members";
  if (operation.startsWith("setting") || operation.includes("_save") && ["academic_session_save","grade_save","section_save"].includes(operation) || operation === "library_update") return "settings";
  return "admin/operators";
}

export async function workspaceMutationAction(formData: FormData) {
  const libraryCode = normalizeLibraryCode(String(formData.get("libraryCode") ?? ""));
  const operation = String(formData.get("operation") ?? ""); const section = destination(operation);
  const context = await getLibraryOperatorContext(libraryCode);
  if (!context || context.demo) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("This mutation is unavailable in the local demonstration workspace.")}`);
  const allowed = new Set(["issue","renew","return","fine_settle","fine_waive","book_save","book_status","copy_save","member_save","setting_update","academic_session_save","grade_save","section_save","library_update","operator_assign","operator_status"]);
  if (!allowed.has(operation)) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Unsupported operation.")}`);

  const payload: Record<string, string | string[] | null> = {};
  for (const key of ["id","memberId","copyId","loanId","fineId","amountMinor","note","reason","title","subtitle","author","isbn","edition","publicationYear","languageCode","publisherId","description","bookId","accession","barcode","locationId","acquiredOn","acquisitionSource","replacementCostMinor","conditionStatus","operationalState","displayName","memberIdentifier","memberKind","status","academicSessionId","gradeLevelId","sectionId","rollNumber","enrollmentStatus","expectedUpdatedAt","settingKey","valueKind","settingValue","sessionCode","displayLabel","startsOn","endsOn","gradeCode","sectionCode","sortOrder","profileId","email","role"]) payload[key === "settingValue" ? "value" : key] = value(formData, key);
  payload.categoryIds = formData.getAll("categoryIds").map(String); payload.subjectIds = formData.getAll("subjectIds").map(String);
  if (operation === "copy_save" && payload.replacementCostMinor) {
    const rupees = Number(payload.replacementCostMinor); if (!Number.isFinite(rupees) || rupees < 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid replacement cost.")}`);
    payload.replacementCostMinor = String(Math.round(rupees * 100));
  }
  if (["fine_settle", "fine_waive"].includes(operation) && payload.amountMinor) {
    const rupees = Number(payload.amountMinor); if (!Number.isFinite(rupees) || rupees <= 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid amount in rupees.")}`);
    payload.amountMinor = String(Math.round(rupees * 100));
    if (operation === "fine_settle") payload.note = payload.reason;
  }
  if (operation === "setting_update" && payload.valueKind === "money_minor") {
    const rupees = Number(payload.value); if (!Number.isFinite(rupees) || rupees < 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid rupee amount.")}`);
    payload.value = String(Math.round(rupees * 100));
  }

  try {
    if (operation === "operator_assign") {
      if (!context.roles.includes("administrator")) throw new Error("GS_ADMIN_REQUIRED");
      const email = String(payload.email ?? "").toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("GS_OPERATOR_INPUT_INVALID");
      const admin = createSupabaseAdminClient();
      let authUser;
      let page = 1;
      do {
        const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) throw listError;
        authUser = existing.users.find((user) => user.email?.toLowerCase() === email);
        if (authUser || !existing.nextPage) break;
        page = existing.nextPage;
      } while (true);
      if (!authUser) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: getAuthCallbackUrl(`/l/${libraryCode}/login`) });
        if (error) throw error; authUser = data.user;
      }
      const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("admin_assign_operator_to_room", {
        p_library_code: libraryCode, p_target_auth_user_id: authUser.id,
        p_display_name: String(payload.displayName ?? email.split("@")[0]), p_role_key: payload.role,
      });
      if (error) throw new Error(error.message);
    } else if (operation === "operator_status") {
      const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("admin_set_room_operator_status", {
        p_library_code: libraryCode, p_target_profile_id: payload.profileId, p_status: payload.status,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", {
        p_library_code: libraryCode, p_operation: operation, p_payload: payload, p_request_id: randomUUID(),
      });
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent(rpcErrorMessage(error))}`);
  }
  revalidatePath(`/operator/${libraryCode}`);
  redirect(`/operator/${libraryCode}/${section}?success=${encodeURIComponent("Saved successfully")}`);
}

export async function circulationSearchAction(libraryCodeInput: string, kind: "members" | "copies" | "loans" | "fines", query: string): Promise<Array<Record<string, unknown>>> {
  const libraryCode = normalizeLibraryCode(libraryCodeInput); const needle = query.trim(); if (needle.length < 2) return [];
  const context = await getLibraryOperatorContext(libraryCode); if (!context || context.demo) return [];
  const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_circulation_search", { p_library_code: libraryCode, p_kind: kind, p_query: needle });
  return error || !Array.isArray(data) ? [] : data as Array<Record<string, unknown>>;
}

export async function changeRoomBookCoverAction(formData: FormData) {
  const libraryCode = normalizeLibraryCode(String(formData.get("libraryCode") ?? "")); const id = value(formData, "id") ?? "";
  const context = await getLibraryOperatorContext(libraryCode); if (!context || context.demo) redirect(`/operator/${libraryCode}/catalogue/${id}?error=${encodeURIComponent("Cover management is unavailable.")}`);
  const admin = createSupabaseAdminClient();
  const { data: current, error: readError } = await admin.from("books").select("cover_storage_path").or(`library_id.eq.${context.libraryId}`).eq("id", id).maybeSingle();
  if (readError || !current) redirect(`/operator/${libraryCode}/catalogue/${id}?error=${encodeURIComponent("The current cover state could not be verified.")}`);
  const cover = formData.get("cover"); const removing = value(formData, "remove") === "true"; let nextPath: string | null = null;
  try {
    if (!removing) {
      if (!(cover instanceof File) || cover.size === 0) throw new Error("Choose a JPEG, PNG, or WebP cover up to 5 MB.");
      nextPath = await createBookCoverUpload(id, cover);
    }
    const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", {
      p_library_code: libraryCode, p_operation: "book_cover",
      p_payload: { id, coverPath: nextPath, expectedCoverPath: current.cover_storage_path }, p_request_id: randomUUID(),
    });
    if (error) throw new Error(error.message);
    const previousPath = (data as { previousPath?: string } | null)?.previousPath;
    await removeBookCoverObject(previousPath);
  } catch (error) {
    if (nextPath) await removeBookCoverObject(nextPath);
    redirect(`/operator/${libraryCode}/catalogue/${id}?error=${encodeURIComponent(error instanceof Error ? rpcErrorMessage(error) : "The cover could not be changed.")}`);
  }
  revalidatePath(`/operator/${libraryCode}/catalogue/${id}`);
  redirect(`/operator/${libraryCode}/catalogue/${id}?success=${encodeURIComponent(removing ? "Cover removed" : "Cover updated")}`);
}
