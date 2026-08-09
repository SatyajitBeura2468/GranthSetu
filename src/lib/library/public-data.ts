import "server-only";

import { cache } from "react";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLibraryCode, validLibraryCode } from "./code";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

export type PublicLibrary = { id: string; code: string; displayName: string; status: "active"; demo?: boolean };
export type PublicBook = {
  id: string; title: string; subtitle: string | null; authorNames: string; isbn: string | null;
  publisherName: string | null; categoryNames: string[]; subjectNames: string[]; languageCode: string | null;
  publicationYear: number | null; description: string | null; totalCopies: number; availableCopies: number;
  availabilityState: "available" | "limited" | "on_loan" | "unavailable"; expectedAvailability: string | null; hasCover: boolean;
};
export type PublicCataloguePage = { books: PublicBook[]; total: number; page: number; pageSize: number };

const demoBooks: PublicBook[] = [
  { id: "10000000-0000-0000-0000-000000000101", title: "Wings of Fire", subtitle: "An Autobiography", authorNames: "A. P. J. Abdul Kalam", isbn: "9788173711466", publisherName: "Universities Press", categoryNames: ["Biography"], subjectNames: ["India"], languageCode: "English", publicationYear: 1999, description: "A life shaped by learning, public service, and an enduring belief in young people.", totalCopies: 5, availableCopies: 3, availabilityState: "available", expectedAvailability: null, hasCover: false },
  { id: "10000000-0000-0000-0000-000000000102", title: "The Discovery of India", subtitle: null, authorNames: "Jawaharlal Nehru", isbn: "9780143031031", publisherName: "Penguin", categoryNames: ["History"], subjectNames: ["India"], languageCode: "English", publicationYear: 1946, description: "A wide-ranging meditation on India's cultural and intellectual inheritance.", totalCopies: 4, availableCopies: 1, availabilityState: "limited", expectedAvailability: null, hasCover: false },
  { id: "10000000-0000-0000-0000-000000000103", title: "A Brief History of Time", subtitle: "From the Big Bang to Black Holes", authorNames: "Stephen Hawking", isbn: "9780553380163", publisherName: "Bantam", categoryNames: ["Science"], subjectNames: ["Physics"], languageCode: "English", publicationYear: 1988, description: "An accessible exploration of cosmology, time, black holes, and the structure of the universe.", totalCopies: 4, availableCopies: 0, availabilityState: "on_loan", expectedAvailability: "2026-08-17", hasCover: false },
  { id: "10000000-0000-0000-0000-000000000104", title: "The God of Small Things", subtitle: null, authorNames: "Arundhati Roy", isbn: "9780006550686", publisherName: "HarperCollins", categoryNames: ["Fiction"], subjectNames: ["Literature"], languageCode: "English", publicationYear: 1997, description: "A lyrical novel about family, memory, and the forces that shape intimate lives.", totalCopies: 3, availableCopies: 2, availabilityState: "available", expectedAvailability: null, hasCover: false },
  { id: "10000000-0000-0000-0000-000000000105", title: "India After Gandhi", subtitle: "The History of the World's Largest Democracy", authorNames: "Ramachandra Guha", isbn: "9780330505543", publisherName: "Pan Macmillan", categoryNames: ["History"], subjectNames: ["Modern India"], languageCode: "English", publicationYear: 2007, description: "A detailed history of independent India and its democratic journey.", totalCopies: 2, availableCopies: 0, availabilityState: "unavailable", expectedAvailability: null, hasCover: false },
  { id: "10000000-0000-0000-0000-000000000106", title: "The Ministry of Utmost Happiness", subtitle: null, authorNames: "Arundhati Roy", isbn: "9780241303979", publisherName: "Hamish Hamilton", categoryNames: ["Fiction"], subjectNames: ["Literature"], languageCode: "English", publicationYear: 2017, description: "A novel of people living at the edges of a changing nation.", totalCopies: 3, availableCopies: 1, availabilityState: "limited", expectedAvailability: null, hasCover: false },
];

const demoLibrary: PublicLibrary = { id: "10000000-0000-0000-0000-000000000001", code: "OAVMUSI", displayName: "OAV Musiguda Library", status: "active", demo: true };

function isLocalDemo(code: string) { return process.env.NODE_ENV === "development" && !getOptionalPublicSupabaseEnv() && code === demoLibrary.code; }

export const getPublicLibrary = cache(async (rawCode: string): Promise<PublicLibrary | null> => {
  const code = normalizeLibraryCode(rawCode);
  if (!validLibraryCode(code)) return null;
  if (isLocalDemo(code)) return demoLibrary;
  if (!getOptionalPublicSupabaseEnv()) return null;
  const client = await createSupabaseServerClient();
  const { data, error } = await asOperatorRpcClient(client).rpc("public_resolve_library", { p_library_code: code });
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; public_code?: string; display_name?: string; status?: string } | null;
  if (error || !row?.id || row.status !== "active") return null;
  return { id: row.id, code: row.public_code ?? code, displayName: row.display_name ?? "Library Room", status: "active" };
});

export async function getPublicCatalogue(rawCode: string, query = "", availableOnly = false): Promise<PublicBook[] | null> {
  const code = normalizeLibraryCode(rawCode);
  const safeQuery = query.trim().slice(0, 160);
  if (isLocalDemo(code)) {
    const needle = safeQuery.toLowerCase();
    return demoBooks.filter((book) => (!availableOnly || book.availableCopies > 0) && (!needle || `${book.title} ${book.authorNames} ${book.isbn ?? ""} ${book.categoryNames.join(" ")}`.toLowerCase().includes(needle)));
  }
  if (!getOptionalPublicSupabaseEnv()) return null;
  const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("public_catalogue", { p_library_code: code, p_query: safeQuery, p_available_only: availableOnly, p_limit: 120 });
  if (error) return null;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPublicBook);
}

export async function getPublicCataloguePage(rawCode: string, query = "", availableOnly = false, requestedPage = 1, pageSize = 24): Promise<PublicCataloguePage | null> {
  const code = normalizeLibraryCode(rawCode);
  const safeQuery = query.trim().slice(0, 160);
  const page = Math.min(1_000_000, Math.max(1, Math.floor(requestedPage) || 1));
  const safePageSize = Math.min(48, Math.max(6, Math.floor(pageSize) || 24));
  if (isLocalDemo(code)) {
    const needle = safeQuery.toLowerCase();
    const filtered = demoBooks.filter((book) => (!availableOnly || book.availableCopies > 0) && (!needle || `${book.title} ${book.authorNames} ${book.isbn ?? ""} ${book.categoryNames.join(" ")} ${book.subjectNames.join(" ")}`.toLowerCase().includes(needle)));
    const resolvedPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / safePageSize)));
    return { books: filtered.slice((resolvedPage - 1) * safePageSize, resolvedPage * safePageSize), total: filtered.length, page: resolvedPage, pageSize: safePageSize };
  }
  if (!getOptionalPublicSupabaseEnv()) return null;
  const client = asOperatorRpcClient(await createSupabaseServerClient());
  const fetchPage = (targetPage: number, limit = safePageSize) => client.rpc("public_catalogue_page", {
    p_library_code: code, p_query: safeQuery, p_available_only: availableOnly, p_limit: limit,
    p_offset: (targetPage - 1) * safePageSize, p_book_id: null,
  });
  const first = await fetchPage(page);
  if (first.error) return null;
  let rows = (first.data ?? []) as Array<Record<string, unknown>>;
  let resolvedPage = page;
  let total = Number(rows[0]?.total_count ?? 0);

  // Empty out-of-range pages carry no aggregate count. Anchor at page one,
  // recover the total, then return the last valid page instead of a false zero.
  if (!rows.length && page > 1) {
    const anchor = await fetchPage(1, 1);
    if (anchor.error) return null;
    const anchorRows = (anchor.data ?? []) as Array<Record<string, unknown>>;
    total = Number(anchorRows[0]?.total_count ?? 0);
    resolvedPage = Math.min(page, Math.max(1, Math.ceil(total / safePageSize)));
    if (total > 0) {
      const resolved = await fetchPage(resolvedPage);
      if (resolved.error) return null;
      rows = (resolved.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  return { books: rows.map(mapPublicBook), total, page: resolvedPage, pageSize: safePageSize };
}

export async function getPublicNewTitles(rawCode: string, limit = 6): Promise<PublicBook[] | null> {
  const code = normalizeLibraryCode(rawCode);
  if (isLocalDemo(code)) return demoBooks.slice(0, Math.max(1, limit));
  if (!getOptionalPublicSupabaseEnv()) return null;
  const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("public_new_titles", { p_library_code: code, p_limit: limit });
  return error ? null : ((data ?? []) as Array<Record<string, unknown>>).map(mapPublicBook);
}

export async function getPublicBook(rawCode: string, id: string): Promise<PublicBook | null> {
  const code = normalizeLibraryCode(rawCode);
  if (isLocalDemo(code)) return demoBooks.find((book) => book.id === id) ?? null;
  if (!getOptionalPublicSupabaseEnv()) return null;
  const { data, error } = await asOperatorRpcClient(await createSupabaseServerClient()).rpc("public_book_detail", { p_library_code: code, p_book_id: id });
  const row = Array.isArray(data) ? data[0] : data;
  return error || !row ? null : mapPublicBook(row as Record<string, unknown>);
}

function mapPublicBook(row: Record<string, unknown>): PublicBook {
  return {
    id: String(row.id), title: String(row.title), subtitle: row.subtitle ? String(row.subtitle) : null,
    authorNames: String(row.author_names ?? "Author not listed"), isbn: row.isbn ? String(row.isbn) : null,
    publisherName: row.publisher_name ? String(row.publisher_name) : null,
    categoryNames: Array.isArray(row.category_names) ? row.category_names.map(String) : [], subjectNames: Array.isArray(row.subject_names) ? row.subject_names.map(String) : [],
    languageCode: row.language_code ? String(row.language_code) : null, publicationYear: row.publication_year ? Number(row.publication_year) : null,
    description: row.description ? String(row.description) : null, totalCopies: Number(row.total_copies ?? 0), availableCopies: Number(row.available_copies ?? 0),
    availabilityState: String(row.availability_state ?? "unavailable") as PublicBook["availabilityState"], expectedAvailability: row.expected_availability ? String(row.expected_availability) : null,
    hasCover: Boolean(row.has_cover),
  };
}
