import { NextResponse } from "next/server";
import { getPublicLibrary } from "@/lib/library/public-data";

export async function GET(_request: Request, { params }: { params: Promise<{ libraryCode: string }> }) {
  const library = await getPublicLibrary((await params).libraryCode);
  return NextResponse.json(
    library ? { valid: true, code: library.code, name: library.displayName } : { valid: false },
    { status: library ? 200 : 404, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
