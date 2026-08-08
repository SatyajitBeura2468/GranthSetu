import Link from "next/link";
import { requireOperator } from "@/lib/auth/authorization";
import { asOperatorRpcClient } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveBookAction, saveReferenceAction, setBookStatusAction } from "./actions";

type BookRow = { id: string; title: string; author_names: string; publisher_name: string | null; total_copies: number; available_copies: number; on_loan_copies: number; status: string; updated_at: string };
type Ref = { id: string; display_name?: string; name?: string };

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  await requireOperator();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const rpc = asOperatorRpcClient(supabase);
  const [booksResult, authorsResult, publishersResult, categoriesResult, subjectsResult] = await Promise.all([
    rpc.rpc("catalogue_books", { p_search: params.q ?? "" }), supabase.from("authors").select("id, display_name").order("display_name"), supabase.from("publishers").select("id, name").order("name"), supabase.from("categories").select("id, name").order("name"), supabase.from("subjects").select("id, name").order("name"),
  ]);
  const books = (booksResult.data ?? []) as BookRow[];
  const authors = (authorsResult.data ?? []) as Ref[];
  const publishers = (publishersResult.data ?? []) as Ref[];
  const categories = (categoriesResult.data ?? []) as Ref[];
  const subjects = (subjectsResult.data ?? []) as Ref[];
  return <section className="operator-page" aria-labelledby="catalogue-title">
    <Link className="auth-secondary-link" href="/operator">← Operator workspace</Link>
    <p className="auth-kicker">Catalogue administration</p><h1 id="catalogue-title">Books, authors, and subjects</h1>
    <p className="operator-lede">Create real catalogue records without editing SQL. Availability below is derived from physical copies and active loans.</p>
    {params.error ? <p className="auth-error" role="alert">{params.error}</p> : null}{params.success ? <p className="auth-success" role="status">{params.success}</p> : null}
    <div className="operator-actions"><Link className="button button-quiet" href="/operator/inventory">Manage inventory</Link><Link className="button button-quiet" href="/operator/members">Manage members</Link></div>
    <form className="operator-invite" action={saveBookAction} encType="multipart/form-data"><h2>Add a book</h2><div className="operator-form-grid operator-form-grid-wide">
      <label className="auth-field">Title *<input name="title" required maxLength={300} /></label><label className="auth-field">Subtitle<input name="subtitle" maxLength={300} /></label><label className="auth-field">ISBN (optional)<input name="isbn" maxLength={40} /></label>
      <label className="auth-field">Edition<input name="edition" maxLength={120} /></label><label className="auth-field">Publication year<input name="publicationYear" type="number" min="1000" max="9999" /></label><label className="auth-field">Language<input name="languageCode" maxLength={20} placeholder="en" /></label>
      <label className="auth-field">Publisher<select name="publisherId" defaultValue=""><option value="">None</option>{publishers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="auth-field">Authors *<select name="authorId" multiple required size={Math.min(5, Math.max(2, authors.length))}>{authors.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      <label className="auth-field">Categories<select name="categoryId" multiple size={Math.min(5, Math.max(2, categories.length))}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="auth-field">Subjects<select name="subjectId" multiple size={Math.min(5, Math.max(2, subjects.length))}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="auth-field">Cover image<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></label><label className="auth-field">Description<textarea name="description" maxLength={10000} rows={4} /></label>
    </div><button className="button" type="submit">Create book</button></form>
    <form className="operator-search" method="get"><label className="auth-field">Search books<input name="q" defaultValue={params.q ?? ""} placeholder="Title, ISBN, or author" /></label><button className="button button-small" type="submit">Search</button></form>
    <div className="operator-table-wrap"><table className="operator-table"><caption>Catalogue ({books.length})</caption><thead><tr><th>Title</th><th>Authors</th><th>Availability</th><th>Status</th><th>Controls</th></tr></thead><tbody>{books.map((book) => <tr key={book.id}><th scope="row"><Link href={`/operator/catalogue/${book.id}`}>{book.title}</Link></th><td>{book.author_names}</td><td>{book.available_copies} of {book.total_copies} available · {book.on_loan_copies} on loan</td><td>{book.status}</td><td><form action={setBookStatusAction}><input type="hidden" name="id" value={book.id} /><input type="hidden" name="status" value={book.status === "active" ? "archived" : "active"} /><button className="button button-small button-quiet" type="submit">{book.status === "active" ? "Archive" : "Restore"}</button></form></td></tr>)}</tbody></table></div>
    <form className="operator-invite" action={saveReferenceAction}><h2>Add a reference record</h2><div className="operator-form-grid"><label className="auth-field">Type<select name="kind" defaultValue="author"><option value="author">Author</option><option value="publisher">Publisher</option><option value="category">Category</option><option value="subject">Subject</option><option value="location">Location</option></select></label><label className="auth-field">Name<input name="name" required maxLength={160} /></label><label className="auth-field">Location code (location only)<input name="code" maxLength={80} /></label></div><button className="button" type="submit">Save reference</button></form>
  </section>;
}
