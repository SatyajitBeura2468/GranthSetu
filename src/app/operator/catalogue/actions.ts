"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { rpcErrorMessage, asOperatorRpcClient } from "@/lib/operator/rpc";
import { formValue, nullable, uuidList } from "@/lib/operator/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBookCoverUpload, removeBookCoverObject } from "@/lib/operator/cover-storage";

const referenceRpc: Record<string, string> = { author: "catalogue_upsert_author", publisher: "catalogue_upsert_publisher", category: "catalogue_upsert_category", subject: "catalogue_upsert_subject", location: "catalogue_upsert_location" };
function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
function success(path: string, message: string): never { redirect(`${path}?success=${encodeURIComponent(message)}`); }

export async function saveReferenceAction(formData: FormData) {
  await assertOperator();
  const kind = formValue(formData, "kind");
  const name = formValue(formData, "name");
  const rpcName = referenceRpc[kind];
  if (!rpcName || !name) fail("/operator/catalogue", "Enter a valid reference name.");
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const args = kind === "location" ? { p_id: null, p_location_code: formValue(formData, "code"), p_display_name: name } : kind === "author" ? { p_id: null, p_display_name: name } : { p_id: null, p_name: name };
  const { error } = await supabase.rpc(rpcName, args);
  if (error) fail("/operator/catalogue", rpcErrorMessage(error));
  success("/operator/catalogue", `${kind} saved`);
}

export async function saveBookAction(formData: FormData) {
  await assertOperator();
  const id = nullable(formValue(formData, "id"));
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("catalogue_upsert_book", {
    p_id: id,
    p_title: formValue(formData, "title"), p_subtitle: nullable(formValue(formData, "subtitle")), p_isbn: nullable(formValue(formData, "isbn")),
    p_edition: nullable(formValue(formData, "edition")), p_publication_year: formValue(formData, "publicationYear") ? Number(formValue(formData, "publicationYear")) : null,
    p_language_code: nullable(formValue(formData, "languageCode")), p_publisher_id: nullable(formValue(formData, "publisherId")), p_description: nullable(formValue(formData, "description")),
    p_author_ids: uuidList(formData, "authorId"), p_category_ids: uuidList(formData, "categoryId"), p_subject_ids: uuidList(formData, "subjectId"),
    p_expected_updated_at: nullable(formValue(formData, "expectedUpdatedAt")),
  });
  if (error || typeof data !== "string") fail(id ? `/operator/catalogue/${id}` : "/operator/catalogue", rpcErrorMessage(error));
  const bookId = data;
  const admin = createSupabaseAdminClient();
  const { data: previous } = await admin.from("books").select("cover_storage_path").eq("id", bookId).maybeSingle();
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    let path: string;
    try { path = await createBookCoverUpload(bookId, cover); } catch (error) { fail(id ? `/operator/catalogue/${id}` : "/operator/catalogue", error instanceof Error ? error.message : "The cover upload failed."); }
    const coverResult = await supabase.rpc("catalogue_set_book_cover", { p_book_id: bookId, p_cover_storage_path: path });
    if (coverResult.error) { await removeBookCoverObject(path); fail(`/operator/catalogue/${bookId}`, rpcErrorMessage(coverResult.error)); }
    const cleanupError = await removeBookCoverObject(previous?.cover_storage_path);
    success(`/operator/catalogue/${bookId}`, cleanupError ? "Book updated; previous cover cleanup needs review." : id ? "Book updated" : "Book created");
  }
  success(`/operator/catalogue/${bookId}`, id ? "Book updated" : "Book created");
}

export async function setBookStatusAction(formData: FormData) {
  await assertOperator();
  const id = formValue(formData, "id");
  const status = formValue(formData, "status");
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const { error } = await supabase.rpc("catalogue_set_book_status", { p_book_id: id, p_status: status });
  if (error) fail("/operator/catalogue", rpcErrorMessage(error));
  success("/operator/catalogue", "Book status updated");
}

export async function removeBookCoverAction(formData: FormData) {
  await assertOperator();
  const id = formValue(formData, "id");
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const admin = createSupabaseAdminClient();
  const { data: previous } = await admin.from("books").select("cover_storage_path").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("catalogue_set_book_cover", { p_book_id: id, p_cover_storage_path: null });
  if (error) fail(`/operator/catalogue/${id}`, rpcErrorMessage(error));
  const cleanupError = await removeBookCoverObject(previous?.cover_storage_path);
  success(`/operator/catalogue/${id}`, cleanupError ? "Cover removed; storage cleanup needs review." : "Cover removed");
}
