"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";
import { getLibraryOperatorContext } from "@/lib/auth/authorization";
import { normalizeLibraryCode } from "@/lib/library/code";
import { rpcErrorMessage, asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBookCoverUpload, removeBookCoverObject } from "@/lib/operator/cover-storage";
import { parseMoneyToMinorUnits } from "@/lib/i18n/library-localization";

function value(form: FormData, key: string) { const result = String(form.get(key) ?? "").trim(); return result || null; }
function validIsbn(value: string) {
  const isbn = value.replace(/[\s-]/g, "").toUpperCase(); if (!isbn) return true;
  if (/^\d{9}[\dX]$/.test(isbn)) return [...isbn].reduce((sum, char, index) => sum + (char === "X" ? 10 : Number(char)) * (10 - index), 0) % 11 === 0;
  if (!/^\d{13}$/.test(isbn)) return false;
  return [...isbn].reduce((sum, char, index) => sum + Number(char) * (index % 2 ? 3 : 1), 0) % 10 === 0;
}
function destination(operation: string) {
  if (["issue","renew","return","fine_settle","fine_waive"].includes(operation)) return "circulation";
  if (operation.startsWith("book") || operation === "reference_save") return "catalogue";
  if (operation.startsWith("copy")) return "inventory";
  if (operation.startsWith("shelf")) return "inventory/shelves";
  if (operation.startsWith("member")) return "members";
  if (operation.startsWith("setting") || operation.includes("_save") && ["academic_session_save","grade_save","section_save"].includes(operation) || ["library_update", "library_localization_update"].includes(operation)) return "settings";
  return "admin/operators";
}
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function workspaceMutationAction(formData: FormData) {
  const libraryCode = normalizeLibraryCode(String(formData.get("libraryCode") ?? ""));
  const operation = String(formData.get("operation") ?? ""); const section = destination(operation);
  const context = await getLibraryOperatorContext(libraryCode);
  if (!context || context.demo) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("This mutation is unavailable in the local demonstration workspace.")}`);
  const allowed = new Set(["issue","renew","return","fine_settle","fine_waive","book_save","book_status","book_cover","copy_save","shelf_save","member_save","setting_update","academic_session_save","grade_save","section_save","library_update","library_localization_update","operator_assign","operator_status","reference_save"]);
  if (!allowed.has(operation)) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Unsupported operation.")}`);
  const requestId = value(formData, operation === "fine_settle" ? "requestIdFineSettle" : operation === "fine_waive" ? "requestIdFineWaive" : "requestId");
  if (!requestIdPattern.test(requestId ?? "")) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("This form is still preparing. Please try again.")}`);

  const payload: Record<string, string | string[] | null> = {};
  for (const key of ["id","memberId","copyId","loanId","fineId","amountMinor","note","reason","title","subtitle","author","isbn","edition","publicationYear","languageCode","publisherId","description","bookId","accession","barcode","locationId","acquiredOn","acquisitionSource","replacementCostMinor","conditionStatus","operationalState","displayName","memberIdentifier","memberKind","status","academicSessionId","gradeLevelId","sectionId","rollNumber","enrollmentStatus","expectedUpdatedAt","settingKey","valueKind","settingValue","sessionCode","displayLabel","startsOn","endsOn","gradeCode","sectionCode","sortOrder","profileId","email","role","kind","name","code","currencyCode","localeCode","timeZone"]) payload[key === "settingValue" ? "value" : key] = value(formData, key);
  payload.categoryIds = formData.getAll("categoryIds").map(String); payload.subjectIds = formData.getAll("subjectIds").map(String);
  if (operation === "book_save") {
    const isbn = String(payload.isbn ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (!validIsbn(String(payload.isbn ?? ""))) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid ISBN-10 or ISBN-13, or leave it blank.")}`);
    payload.isbn = isbn || null;
    const year = payload.publicationYear; if (year && (!/^\d{4}$/.test(String(year)) || Number(year) < 1000 || Number(year) > new Date().getFullYear() + 1)) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid four-digit publication year.")}`);
    const categoryId = value(formData, "categoryId"); const categoryName = value(formData, "categoryName");
    if (categoryName) {
      const categoryRequestId = crypto.randomUUID();
      const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", { p_library_code: libraryCode, p_operation: "reference_save", p_payload: { kind: "category", name: categoryName, code: null }, p_request_id: categoryRequestId });
      if (error) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent(rpcErrorMessage(new Error(error.message)))}`);
      const createdId = (data as { id?: string } | null)?.id; if (createdId) payload.categoryIds = [createdId];
    } else if (categoryId) payload.categoryIds = [categoryId];
  }
  if (operation === "copy_save" && payload.replacementCostMinor) {
    const minor = parseMoneyToMinorUnits(String(payload.replacementCostMinor), context.currencyCode); if (minor === null || minor < 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid replacement cost.")}`);
    payload.replacementCostMinor = String(minor);
  }
  if (["fine_settle", "fine_waive"].includes(operation) && payload.amountMinor) {
    const minor = parseMoneyToMinorUnits(String(payload.amountMinor), context.currencyCode); if (minor === null || minor <= 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid amount.")}`);
    payload.amountMinor = String(minor);
    if (operation === "fine_settle") payload.note = payload.reason;
  }
  if (operation === "setting_update" && payload.valueKind === "money_minor") {
    const minor = parseMoneyToMinorUnits(String(payload.value), context.currencyCode); if (minor === null || minor < 0) redirect(`/operator/${libraryCode}/${section}?error=${encodeURIComponent("Enter a valid amount.")}`);
    payload.value = String(minor);
  }

  try {
    if (operation === "shelf_save") {
      const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_shelf_save", { p_library_code: libraryCode, p_id: payload.id, p_name: payload.name, p_code: payload.code, p_status: payload.status, p_request_id: requestId });
      if (error) throw new Error(error.message);
      revalidatePath(`/operator/${libraryCode}/inventory`); revalidatePath(`/operator/${libraryCode}/inventory/shelves`);
      redirect(`/operator/${libraryCode}/inventory/shelves?success=${encodeURIComponent("Shelf saved successfully")}`);
    }
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
      payload.targetAuthUserId = authUser.id;
    }
    const { error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", {
      p_library_code: libraryCode, p_operation: operation, p_payload: payload, p_request_id: requestId,
    });
    if (error) throw new Error(error.message);
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
    const requestId = value(formData, "requestId");
    if (!requestIdPattern.test(requestId ?? "")) throw new Error("GS_REQUEST_ID_REQUIRED");
    const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("operator_workspace_mutation", {
      p_library_code: libraryCode, p_operation: "book_cover",
      p_payload: { id, coverPath: nextPath, expectedCoverPath: current.cover_storage_path }, p_request_id: requestId,
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
