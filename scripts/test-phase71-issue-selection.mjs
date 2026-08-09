import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { reconcileIssueSelection } from "../src/app/operator/circulation/issue-book-selection.mjs";

// Disposable local-only coverage for explicit issue selection. Never point
// this at hosted Supabase or real school data.
const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if ((!url.includes("127.0.0.1") && !url.includes("localhost") && !url.includes("kong")) || !anonKey || !serviceKey) throw new Error("Refusing explicit-selection tests outside local Supabase.");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const token = crypto.randomUUID();
const password = "Phase71-Issue-Password-2026!";
const createdMembers = [];
const createdCopies = [];
const createdLoans = [];
const createdUsers = [];
const createdProfiles = [];
let bookId;
let libraryId;

try {
  const library = await admin.from("libraries").select("id").eq("public_code", "OAVMUSI").single();
  assert(!library.error && library.data?.id, `bootstrap library missing: ${library.error?.message}`);
  libraryId = library.data.id;
  const email = `phase71-issue-${token}@phase71.invalid`;
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!user.error && user.data.user, `issue operator creation failed: ${user.error?.message}`);
  createdUsers.push(user.data.user.id);
  const profile = await admin.from("profiles").insert({ auth_user_id: user.data.user.id, display_name: "Phase 7.1 Issue Operator", status: "active" }).select("id").single();
  assert(!profile.error, `issue profile creation failed: ${profile.error?.message}`);
  createdProfiles.push(profile.data.id);
  const role = await admin.from("roles").select("id").eq("role_key", "librarian").single();
  const assignment = await admin.from("profile_roles").insert({ profile_id: profile.data.id, library_id: libraryId, role_id: role.data.id });
  assert(!assignment.error, `issue role assignment failed: ${assignment.error?.message}`);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert(!signedIn.error, `issue operator sign-in failed: ${signedIn.error?.message}`);

  const memberRows = await admin.from("members").insert([
    { library_id: libraryId, member_identifier: `PHASE71-SELECT-A-${token}`, member_kind: "teacher", display_name: `Phase71 Select A ${token}`, status: "active" },
    { library_id: libraryId, member_identifier: `PHASE71-SELECT-B-${token}`, member_kind: "teacher", display_name: `Phase71 Select B ${token}`, status: "active" },
    { library_id: libraryId, member_identifier: `PHASE71-SELECT-C-${token}`, member_kind: "teacher", display_name: `Phase71 Select C ${token}`, status: "active" },
  ]).select("id,display_name");
  assert(!memberRows.error && memberRows.data.length === 3, `issue member fixture failed: ${memberRows.error?.message}`);
  createdMembers.push(...memberRows.data.map((row) => row.id));
  const [memberA, memberB, memberC] = createdMembers;
  const book = await admin.from("books").insert({ library_id: libraryId, title: `Phase71 Explicit Selection ${token}`, status: "active" }).select("id").single();
  assert(!book.error, `issue book fixture failed: ${book.error?.message}`);
  bookId = book.data.id;
  const copies = await admin.from("book_copies").insert([
    { library_id: libraryId, book_id: bookId, accession_number: `PHASE71-SELECT-X-${token}`, operational_state: "active" },
    { library_id: libraryId, book_id: bookId, accession_number: `PHASE71-SELECT-Y-${token}`, operational_state: "active" },
  ]).select("id,accession_number");
  assert(!copies.error && copies.data.length === 2, `issue copy fixture failed: ${copies.error?.message}`);
  createdCopies.push(...copies.data.map((row) => row.id));
  const [copyX, copyY] = createdCopies;

  const memberCandidates = await client.rpc("circulation_member_search", { p_query: token, p_limit: 50 });
  assert(!memberCandidates.error && memberCandidates.data.some((row) => row.member_id === memberA) && memberCandidates.data.some((row) => row.member_id === memberB), "multiple borrower candidates were not returned for explicit selection");
  const copyCandidates = await client.rpc("circulation_copy_search", { p_query: token, p_available_only: true, p_limit: 50 });
  assert(!copyCandidates.error && copyCandidates.data.some((row) => row.copy_id === copyX) && copyCandidates.data.some((row) => row.copy_id === copyY), "multiple available copy candidates were not returned for explicit selection");

  const issued = await client.rpc("circulation_issue_loan", { p_member_id: memberA, p_book_copy_id: copyX, p_request_id: crypto.randomUUID(), p_notes: "explicit selection regression" });
  assert(!issued.error && issued.data?.member_id === memberA && issued.data?.copy_id === copyX, "selected borrower/copy did not remain bound to the issued loan");
  createdLoans.push(issued.data.loan_id);
  const afterIssue = await client.rpc("circulation_copy_search", { p_query: token, p_available_only: true, p_limit: 50 });
  assert(!afterIssue.error && !afterIssue.data.some((row) => row.copy_id === copyX) && afterIssue.data.some((row) => row.copy_id === copyY), "an already-loaned copy remained selectable as available");

  const concurrent = await Promise.all([memberB, memberC].map((memberId) => client.rpc("circulation_issue_loan", { p_member_id: memberId, p_book_copy_id: copyY, p_request_id: crypto.randomUUID() })));
  assert(concurrent.filter((result) => !result.error).length === 1, "concurrent issue attempts were not serialized by the trusted RPC");
  const winningLoan = concurrent.find((result) => !result.error)?.data?.loan_id;
  if (winningLoan) createdLoans.push(winningLoan);
  const malformed = await client.rpc("circulation_issue_loan", { p_member_id: "not-a-uuid", p_book_copy_id: copyY, p_request_id: crypto.randomUUID() });
  assert(malformed.error, "malformed member identity was accepted by the trusted issue operation");

  const page = await readFile(new URL("../src/app/operator/circulation/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../src/app/operator/circulation/issue-book-form.tsx", import.meta.url), "utf8");
  assert(page.includes("<IssueBookForm") && !page.includes("members[0]?.member_id") && !page.includes("copies[0]?.copy_id"), "server page still binds issue identity to the first result");
  assert(form.includes("selectedMemberId") && form.includes("selectedCopyId") && form.includes("disabled={!visibleSelection.canIssue}"), "issue form is not gated on two explicit visible selections");
  assert(form.includes("setSelectedMemberId(null)") && form.includes("setSelectedCopyId(null)"), "editing search terms does not clear stale selections");
  assert(form.includes("reconcileIssueSelection") && form.includes("visibleSelection.selectedMemberId") && form.includes("visibleSelection.selectedCopyId"), "candidate lifecycle reconciliation is not wired into rendered selection and hidden fields");
  assert(page.includes("key={issueCandidateContextKey}"), "candidate context navigation does not remount the issue form");
  const candidates = (memberIds, copyIds) => ({ members: memberIds.map((member_id) => ({ member_id })), copies: copyIds.map((copy_id) => ({ copy_id })) });
  const hidden = (selection) => ({ memberId: selection.selectedMemberId ?? "", copyId: selection.selectedCopyId ?? "" });
  const assertLifecycle = (selection, memberId, copyId, canIssue, label) => {
    assert(selection.selectedMemberId === memberId && selection.selectedCopyId === copyId && selection.canIssue === canIssue, `${label}: stale lifecycle selection survived candidate navigation`);
    const values = hidden(selection);
    assert(values.memberId === (memberId ?? "") && values.copyId === (copyId ?? ""), `${label}: hidden issue IDs retained invisible candidates`);
  };
  let lifecycle = reconcileIssueSelection("A", "X", ...Object.values(candidates(["B"], ["X"])), true);
  assertLifecycle(lifecycle, null, "X", false, "member-only navigation");
  lifecycle = reconcileIssueSelection("A", "X", ...Object.values(candidates(["A"], ["Y"])), true);
  assertLifecycle(lifecycle, "A", null, false, "copy-only navigation");
  lifecycle = reconcileIssueSelection("A", "X", ...Object.values(candidates(["B"], ["Y"])), true);
  assertLifecycle(lifecycle, null, null, false, "combined navigation");
  lifecycle = reconcileIssueSelection("B", "Y", ...Object.values(candidates(["B"], ["Y"])), true);
  assertLifecycle(lifecycle, "B", "Y", true, "new explicit selection after navigation");
  console.log("Phase 7.1 explicit-selection issue regression passed: multiple candidates, exact member/copy binding, availability filtering, concurrency, malformed identity rejection, and member/copy navigation stale-selection clearing.");
} finally {
  await admin.from("loans").delete().in("id", createdLoans);
  await admin.from("book_copies").delete().in("id", createdCopies);
  if (bookId) await admin.from("books").delete().eq("id", bookId);
  await admin.from("members").delete().in("id", createdMembers);
  await admin.from("profile_roles").delete().in("profile_id", createdProfiles);
  await admin.from("profiles").delete().in("id", createdProfiles);
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
