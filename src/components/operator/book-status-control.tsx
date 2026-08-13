"use client";

import { useRef, useState } from "react";
import { workspaceMutationAction } from "@/app/operator/[libraryCode]/actions";
import { MutationRequestId, MutationSubmitButton } from "@/components/operator/mutation-controls";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function BookStatusControl({ libraryCode, bookId, status, disabled = false }: { libraryCode: string; bookId: string; status: string; disabled?: boolean }) {
  const archiving = status === "active";
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const approved = useRef(false);
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (archiving && !approved.current) {
      event.preventDefault();
      setConfirming(true);
    }
    approved.current = false;
  }
  function confirmArchive() {
    approved.current = true;
    setConfirming(false);
    formRef.current?.requestSubmit();
  }
  return <div className="book-status-control"><form ref={formRef} action={workspaceMutationAction} onSubmit={handleSubmit}><input type="hidden" name="libraryCode" value={libraryCode} /><input type="hidden" name="operation" value="book_status" /><input type="hidden" name="id" value={bookId} /><input type="hidden" name="status" value={archiving ? "archived" : "active"} /><MutationRequestId /><MutationSubmitButton idleLabel={archiving ? "Archive title" : "Restore title"} className="button button-small button-secondary" disabled={disabled} /></form><p>{archiving ? "Archived titles are hidden from the public catalogue but remain in your library records." : "This title is currently hidden from the public catalogue."}</p>{archiving ? <ConfirmationDialog open={confirming} title="Archive this title?" description="It will disappear from the public and student catalogue until it is restored. Your library record stays intact." confirmLabel="Archive title" onCancel={() => setConfirming(false)} onConfirm={confirmArchive} /> : null}</div>;
}
