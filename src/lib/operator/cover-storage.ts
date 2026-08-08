import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bucket = "book-covers";
const validPath = /^book-covers\/[0-9a-f-]+\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/;

export async function removeBookCoverObject(path: string | null | undefined) {
  if (!path || !validPath.test(path)) return null;
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove([path]);
  return error?.message ?? null;
}

export async function createBookCoverUpload(bookId: string, cover: File) {
  if (cover.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(cover.type)) throw new Error("Cover must be JPEG, PNG, or WebP and no larger than 5 MB.");
  const ext = cover.type === "image/jpeg" ? "jpg" : cover.type === "image/png" ? "png" : "webp";
  const path = `book-covers/${bookId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createSupabaseAdminClient().storage.from(bucket).upload(path, cover, { contentType: cover.type, upsert: false });
  if (error) throw new Error("The book was saved, but the cover upload failed.");
  return path;
}

export async function signedBookCoverUrl(path: string | null | undefined) {
  if (!path || !validPath.test(path)) return null;
  const { data } = await createSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
