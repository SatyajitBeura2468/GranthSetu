import { NextResponse } from "next/server";
import { getPublicBook, getPublicLibrary } from "@/lib/library/public-data";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const COVER_PATH = /^book-covers\/[0-9a-f-]+\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ libraryCode: string; bookId: string }> },
) {
  const { libraryCode, bookId } = await params;
  const [library, book] = await Promise.all([
    getPublicLibrary(libraryCode),
    getPublicBook(libraryCode, bookId),
  ]);

  if (!library || !book?.hasCover) return new NextResponse(null, { status: 404 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await asOperatorRpcClient(admin).rpc("public_book_cover_path", {
    p_library_code: library.code,
    p_book_id: book.id,
  });
  const path = typeof data === "string" ? data : null;

  if (error || !path || !COVER_PATH.test(path)) return new NextResponse(null, { status: 404 });

  const { data: signed, error: signingError } = await admin.storage
    .from("book-covers")
    .createSignedUrl(path, 10 * 60);
  if (signingError || !signed?.signedUrl) return new NextResponse(null, { status: 404 });

  const response = NextResponse.redirect(signed.signedUrl, 307);
  response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=240");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
