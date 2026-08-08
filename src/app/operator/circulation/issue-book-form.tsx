"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { issueLoanAction } from "./actions";
import { reconcileIssueSelection } from "./issue-book-selection.mjs";

type Member = {
  member_id: string;
  member_identifier: string;
  display_name: string;
  member_kind: string;
  enrollment_label: string | null;
  roll_number: string | null;
};

type Copy = {
  copy_id: string;
  title: string;
  author_names: string;
  isbn: string | null;
  accession_number: string;
  barcode: string | null;
  location_name: string | null;
  operational_state: string;
};

type Props = {
  members: Member[];
  copies: Copy[];
  ready: boolean;
  requestId: string;
  initialMemberSearch: string;
  initialCopySearch: string;
  loanSearch: string;
  fineSearch: string;
};

function buildSearchUrl(member: string, copy: string, loan: string, fine: string) {
  const params = new URLSearchParams();
  if (member.trim()) params.set("member", member.trim());
  if (copy.trim()) params.set("copy", copy.trim());
  if (loan.trim()) params.set("loan", loan.trim());
  if (fine.trim()) params.set("fine", fine.trim());
  const query = params.toString();
  return query ? `/operator/circulation?${query}` : "/operator/circulation";
}

export function IssueBookForm({ members, copies, ready, requestId, initialMemberSearch, initialCopySearch, loanSearch, fineSearch }: Props) {
  const router = useRouter();
  const [memberSearch, setMemberSearch] = useState(initialMemberSearch);
  const [copySearch, setCopySearch] = useState(initialCopySearch);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null);

  const visibleSelection = reconcileIssueSelection(selectedMemberId, selectedCopyId, members, copies, ready);

  function searchCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildSearchUrl(memberSearch, copySearch, loanSearch, fineSearch));
  }

  return <article className="operator-invite">
    <h2>Issue a book</h2>
    <form className="auth-form" onSubmit={searchCandidates}>
      <label className="auth-field">Member search
        <input name="memberSearch" value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSelectedMemberId(null); }} placeholder="Name, ID, roll, grade, or section" />
      </label>
      <label className="auth-field">Copy search
        <input name="copySearch" value={copySearch} onChange={(event) => { setCopySearch(event.target.value); setSelectedCopyId(null); }} placeholder="Title, author, ISBN, accession, barcode" />
      </label>
      <button className="button button-small" type="submit">Search candidates</button>
    </form>
    <p className="operator-muted" role="status">Search results are server-backed and bounded. Select exactly one borrower and one physical copy before issuing.</p>
    <div className="circulation-selection-grid">
      <fieldset className="circulation-selection">
        <legend>Borrower candidates ({members.length})</legend>
        {members.length ? <div className="circulation-candidate-list" role="listbox" aria-label="Borrower candidates">
          {members.map((member) => <button key={member.member_id} type="button" role="option" aria-selected={visibleSelection.selectedMemberId === member.member_id} className={`circulation-candidate${visibleSelection.selectedMemberId === member.member_id ? " is-selected" : ""}`} onClick={() => setSelectedMemberId(member.member_id)}>
            <strong>{member.display_name}</strong><span>{member.member_identifier} · {member.member_kind}</span><span>{member.enrollment_label ?? "No current enrollment"}{member.roll_number ? ` · Roll ${member.roll_number}` : ""}</span>
          </button>)}
        </div> : <p className="operator-muted">No borrower candidates. Search again with a narrower or different term.</p>}
      </fieldset>
      <fieldset className="circulation-selection">
        <legend>Physical-copy candidates ({copies.length})</legend>
        {copies.length ? <div className="circulation-candidate-list" role="listbox" aria-label="Physical-copy candidates">
          {copies.map((copy) => <button key={copy.copy_id} type="button" role="option" aria-selected={visibleSelection.selectedCopyId === copy.copy_id} className={`circulation-candidate${visibleSelection.selectedCopyId === copy.copy_id ? " is-selected" : ""}`} onClick={() => setSelectedCopyId(copy.copy_id)}>
            <strong>{copy.title}</strong><span>{copy.accession_number}{copy.barcode ? ` · ${copy.barcode}` : ""}</span><span>{copy.author_names}{copy.isbn ? ` · ISBN ${copy.isbn}` : ""} · {copy.location_name ?? "Unassigned"}</span>
          </button>)}
        </div> : <p className="operator-muted">No available copies. Search again with a narrower or different term.</p>}
      </fieldset>
    </div>
    <form className="auth-form" action={issueLoanAction}>
      <input type="hidden" name="memberId" value={visibleSelection.selectedMemberId ?? ""} />
      <input type="hidden" name="copyId" value={visibleSelection.selectedCopyId ?? ""} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="auth-field">Notes<input name="notes" maxLength={2000} /></label>
      <button className="button" type="submit" disabled={!visibleSelection.canIssue}>Issue selected copy</button>
    </form>
  </article>;
}
