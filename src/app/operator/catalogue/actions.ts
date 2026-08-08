"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { rpcErrorMessage, asOperatorRpcClient } from "@/lib/operator/rpc";
import { formValue, nullable, uuidList } from "@/lib/operator/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (cover.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(cover.type)) fail(id ? `/operator/catalogue/${id}` : "/operator/catalogue", "Cover must be JPEG, PNG, or WebP and no larger than 5 MB.");
    const ext = cover.type === "image/jpeg" ? "jpg" : cover.type === "image/png" ? "png" : "webp";
    const path = `book-covers/${bookId}/${crypto.randomUUID()}.${ext}`;
    const admin = createSupabaseAdminClient();
    const uploaded = await admin.storage.from("book-covers").upload(path, cover, { contentType: cover.type, upsert: false });
    if (uploaded.error) fail(id ? `/operator/catalogue/${id}` : "/operator/catalogue", "The book was saved, but the cover upload failed.");
    const coverResult = await supabase.rpc("catalogue_set_book_cover", { p_book_id: bookId, p_cover_storage_path: path });
    if (coverResult.error) fail(`/operator/catalogue/${bookId}`, rpcErrorMessage(coverResult.error));
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
  const { error } = await supabase.rpc("catalogue_set_book_cover", { p_book_id: id, p_cover_storage_path: null });
  if (error) fail(`/operator/catalogue/${id}`, rpcErrorMessage(error));
  success(`/operator/catalogue/${id}`, "Cover removed");
}
