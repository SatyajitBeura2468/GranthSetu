/* eslint-disable @next/next/no-img-element -- signed private storage URLs are rendered without remote image configuration. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeBookCoverAction, saveBookAction } from "../actions";
import { signedBookCoverUrl } from "@/lib/operator/cover-storage";

export default async function EditBookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireOperator();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: book }, { data: authors }, { data: publishers }, { data: categories }, { data: subjects }, { data: linkedAuthors }, { data: linkedCategories }, { data: linkedSubjects }] = await Promise.all([
    supabase.from("books").select("id,title,subtitle,isbn,edition,publication_year,language_code,publisher_id,description,status,cover_storage_path,updated_at").eq("id", id).maybeSingle(),
    supabase.from("authors").select("id,display_name").order("display_name"), supabase.from("publishers").select("id,name").order("name"), supabase.from("categories").select("id,name").order("name"), supabase.from("subjects").select("id,name").order("name"),
    supabase.from("book_authors").select("author_id").eq("book_id", id), supabase.from("book_categories").select("category_id").eq("book_id", id), supabase.from("book_subjects").select("subject_id").eq("book_id", id),
  ]);
  if (!book) notFound();
  let coverUrl: string | null = null;
  try {
    coverUrl = await signedBookCoverUrl(book.cover_storage_path);
  } catch {
    // A private preview is optional; it must not block metadata editing when privileged credentials are unavailable.
  }
  const selectedAuthors = new Set((linkedAuthors ?? []).map((row) => row.author_id));
  const selectedCategories = new Set((linkedCategories ?? []).map((row) => row.category_id));
  const selectedSubjects = new Set((linkedSubjects ?? []).map((row) => row.subject_id));
  return <section className="operator-page" aria-labelledby="edit-book-title">
    <Link className="auth-secondary-link" href="/operator/catalogue">← Catalogue</Link><p className="auth-kicker">Catalogue administration</p><h1 id="edit-book-title">Edit book</h1>
    {query.error ? <p className="auth-error" role="alert">{query.error}</p> : null}{query.success ? <p className="auth-success" role="status">{query.success}</p> : null}
    {coverUrl ? <figure className="operator-card"><img src={coverUrl} alt={`Cover of ${book.title}`} style={{ maxWidth: "14rem", maxHeight: "18rem", objectFit: "contain" }} /><figcaption className="operator-muted">Private signed preview · expires in one hour</figcaption></figure> : <p className="operator-muted">No private cover uploaded.</p>}
    <form className="operator-invite" action={saveBookAction} encType="multipart/form-data"><input type="hidden" name="id" value={book.id} /><input type="hidden" name="expectedUpdatedAt" value={book.updated_at} /><div className="operator-form-grid operator-form-grid-wide">
      <label className="auth-field">Title *<input name="title" defaultValue={book.title} required maxLength={300} /></label><label className="auth-field">Subtitle<input name="subtitle" defaultValue={book.subtitle ?? ""} maxLength={300} /></label><label className="auth-field">ISBN<input name="isbn" defaultValue={book.isbn ?? ""} maxLength={40} /></label><label className="auth-field">Edition<input name="edition" defaultValue={book.edition ?? ""} maxLength={120} /></label><label className="auth-field">Publication year<input name="publicationYear" type="number" min="1000" max="9999" defaultValue={book.publication_year ?? ""} /></label><label className="auth-field">Language<input name="languageCode" defaultValue={book.language_code ?? ""} maxLength={20} /></label>
      <label className="auth-field">Publisher<select name="publisherId" defaultValue={book.publisher_id ?? ""}><option value="">None</option>{(publishers ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="auth-field">Authors *<select name="authorId" multiple required size={Math.min(5, Math.max(2, (authors ?? []).length))}>{(authors ?? []).map((item) => <option key={item.id} value={item.id} selected={selectedAuthors.has(item.id)}>{item.display_name}</option>)}</select></label><label className="auth-field">Categories<select name="categoryId" multiple size={Math.min(5, Math.max(2, (categories ?? []).length))}>{(categories ?? []).map((item) => <option key={item.id} value={item.id} selected={selectedCategories.has(item.id)}>{item.name}</option>)}</select></label><label className="auth-field">Subjects<select name="subjectId" multiple size={Math.min(5, Math.max(2, (subjects ?? []).length))}>{(subjects ?? []).map((item) => <option key={item.id} value={item.id} selected={selectedSubjects.has(item.id)}>{item.name}</option>)}</select></label><label className="auth-field">Replace cover<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></label><label className="auth-field">Description<textarea name="description" defaultValue={book.description ?? ""} maxLength={10000} rows={5} /></label>
    </div><button className="button" type="submit">Save book</button></form>
    <div className="operator-actions"><strong>Lifecycle:</strong> {book.status}<form action={removeBookCoverAction}><input type="hidden" name="id" value={book.id} /><button className="button button-small button-quiet" type="submit">Remove cover</button></form></div>
  </section>;
}
