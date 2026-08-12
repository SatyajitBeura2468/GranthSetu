"use client";

import { workspaceMutationAction } from "@/app/operator/[libraryCode]/actions";
import { MutationRequestId, MutationSubmitButton } from "@/components/operator/mutation-controls";

export function BookStatusControl({ libraryCode, bookId, status, disabled = false }: { libraryCode: string; bookId: string; status: string; disabled?: boolean }) {
  const archiving = status === "active";
  return <div className="book-status-control"><form action={workspaceMutationAction} onSubmit={(event) => {
    if (archiving && !window.confirm("Archive this title? It will disappear from the public/student catalogue until restored.")) event.preventDefault();
  }}><input type="hidden" name="libraryCode" value={libraryCode} /><input type="hidden" name="operation" value="book_status" /><input type="hidden" name="id" value={bookId} /><input type="hidden" name="status" value={archiving ? "archived" : "active"} /><MutationRequestId /><MutationSubmitButton idleLabel={archiving ? "Archive title" : "Restore title"} className="button button-small button-secondary" disabled={disabled} /></form><p>{archiving ? "Archived titles are hidden from the public catalogue but remain in your library records." : "This title is currently hidden from the public catalogue."}</p></div>;
}
