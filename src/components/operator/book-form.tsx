import { workspaceMutationAction } from "@/app/operator/[libraryCode]/actions";
import { MutationRequestId, MutationSubmitButton } from "@/components/operator/mutation-controls";

type Ref = { id: string; name: string };
type Book = { id?: string; title?: string; subtitle?: string; isbn?: string; edition?: string; publication_year?: number; language_code?: string; publisher_id?: string; description?: string; updated_at?: string; category_ids?: string[]; subject_ids?: string[] };

export function BookForm({ libraryCode, book, author, publishers, categories, subjects, disabled = false, submitLabel = "Save book" }: {
  libraryCode: string; book?: Book; author?: string; publishers: Ref[]; categories: Ref[]; subjects: Ref[]; disabled?: boolean; submitLabel?: string;
}) {
  return <form action={workspaceMutationAction} className="popover-form book-form">
    <input type="hidden" name="libraryCode" value={libraryCode} /><input type="hidden" name="operation" value="book_save" />
    {book?.id ? <><input type="hidden" name="id" value={book.id} /><input type="hidden" name="expectedUpdatedAt" value={book.updated_at} /></> : null}
    <label>Title<input name="title" defaultValue={book?.title} required maxLength={300} disabled={disabled} /></label>
    <label>Subtitle<input name="subtitle" defaultValue={book?.subtitle} maxLength={300} disabled={disabled} /></label>
    <label>Author names<input name="author" defaultValue={author} required maxLength={500} disabled={disabled} /><small>Separate multiple authors with commas.</small></label>
    <div className="form-grid"><label>ISBN<input name="isbn" defaultValue={book?.isbn} maxLength={32} disabled={disabled} /></label><label>Edition<input name="edition" defaultValue={book?.edition} maxLength={80} disabled={disabled} /></label><label>Publication year<input name="publicationYear" type="number" min="1000" max="2100" defaultValue={book?.publication_year} disabled={disabled} /></label><label>Language<input name="languageCode" defaultValue={book?.language_code ?? "English"} maxLength={32} disabled={disabled} /></label></div>
    <label>Publisher<select name="publisherId" defaultValue={book?.publisher_id ?? ""} disabled={disabled}><option value="">Not listed</option>{publishers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="form-grid"><label>Categories<select name="categoryIds" multiple defaultValue={book?.category_ids ?? []} disabled={disabled}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Subjects<select name="subjectIds" multiple defaultValue={book?.subject_ids ?? []} disabled={disabled}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <label>Description<textarea name="description" defaultValue={book?.description} maxLength={10000} rows={5} disabled={disabled} /></label>
    <MutationRequestId /><MutationSubmitButton idleLabel={submitLabel} pendingLabel={book?.id ? "Saving…" : "Creating…"} disabled={disabled} />
  </form>;
}
