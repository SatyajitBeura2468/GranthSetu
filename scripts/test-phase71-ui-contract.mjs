import { readFile } from "node:fs/promises";
import { reconcileIssueSelection } from "../src/app/operator/circulation/issue-book-selection.mjs";

const page = await readFile(new URL("../src/app/operator/circulation/page.tsx", import.meta.url), "utf8");
const workspaceSearchPage = await readFile(new URL("../src/app/operator/[libraryCode]/search/page.tsx", import.meta.url), "utf8");
const form = await readFile(new URL("../src/app/operator/circulation/issue-book-form.tsx", import.meta.url), "utf8");
const reports = await readFile(new URL("../src/app/operator/reports/page.tsx", import.meta.url), "utf8");
const catalogueActions = await readFile(new URL("../src/app/operator/catalogue/actions.ts", import.meta.url), "utf8");
const coverStorage = await readFile(new URL("../src/lib/operator/cover-storage.ts", import.meta.url), "utf8");
const editBookPage = await readFile(new URL("../src/app/operator/catalogue/[id]/page.tsx", import.meta.url), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(page.includes("<IssueBookForm") && !page.includes("members[0]?.member_id") && !page.includes("copies[0]?.copy_id"), "server page still binds issue identity to the first result");
assert(form.includes("selectedMemberId") && form.includes("selectedCopyId") && form.includes("disabled={!visibleSelection.canIssue}"), "issue form is not gated on two explicit visible selections");
assert(form.includes("setSelectedMemberId(null)") && form.includes("setSelectedCopyId(null)"), "editing search terms does not clear stale selections");
assert(form.includes("router.push(buildSearchUrl"), "issue search is not server-backed through the circulation route");
assert(form.includes("reconcileIssueSelection") && form.includes("visibleSelection.selectedMemberId") && form.includes("visibleSelection.selectedCopyId"), "candidate lifecycle reconciliation is not wired into rendered selection and hidden fields");
assert(page.includes("key={issueCandidateContextKey}") && page.includes("params.member ?? \"\"") && page.includes("params.copy ?? \"\""), "candidate context changes do not remount the issue form");
assert(reports.includes("function exportQuery") && reports.includes("kind === \"overdue\"") && reports.includes("kind !== \"popular\" && kind !== \"inventory\""), "report filters are not constrained to the supported report arguments");
assert(workspaceSearchPage.includes('result_type === "loan"') && workspaceSearchPage.includes('/operator/${libraryCode}/${meta.path}/${result.result_id}'), "room-scoped global search results do not route to their selected record");
assert(page.includes("Borrower search is unavailable") && page.includes("Copy search is unavailable") && page.includes("Loan search is unavailable") && page.includes("Fine search is unavailable"), "circulation search failures are not surfaced as unavailable workflows");
assert(catalogueActions.includes("catalogue_set_book_cover_v71") && catalogueActions.includes("p_expected_cover_storage_path") && catalogueActions.includes("typeof replacedPath === \"string\""), "cover replacement cleanup is not bound to an atomic expected-path mutation");
const saveBookAction = catalogueActions.slice(catalogueActions.indexOf("export async function saveBookAction"), catalogueActions.indexOf("export async function setBookStatusAction"));
assert(saveBookAction.indexOf("const cover = formData.get(\"cover\")") < saveBookAction.indexOf("if (cover instanceof File && cover.size > 0)") && saveBookAction.indexOf("if (cover instanceof File && cover.size > 0)") < saveBookAction.indexOf("const admin = createSupabaseAdminClient()"), "metadata-only book saves still construct a privileged cover client");
assert(coverStorage.includes('select("id", { count: "exact", head: true }).eq("cover_storage_path", path)') && coverStorage.includes("if ((count ?? 0) > 0) return null;") && coverStorage.indexOf("if ((count ?? 0) > 0) return null;") < coverStorage.indexOf(".storage.from(bucket).remove([path])"), "cover cleanup does not retain shared legacy paths before deletion");
assert(editBookPage.includes("let coverUrl: string | null = null;") && editBookPage.includes("try {") && editBookPage.includes("coverUrl = await signedBookCoverUrl(book.cover_storage_path);") && editBookPage.includes("} catch {") && editBookPage.includes("private preview is optional"), "book editing does not tolerate unavailable privileged cover previews");

const member = (member_id) => ({ member_id });
const copy = (copy_id) => ({ copy_id });
const hiddenValues = (selection) => ({ memberId: selection.selectedMemberId ?? "", copyId: selection.selectedCopyId ?? "" });
const assertSelection = (selection, expectedMemberId, expectedCopyId, expectedCanIssue, label) => {
  assert(selection.selectedMemberId === expectedMemberId && selection.selectedCopyId === expectedCopyId, `${label}: stale selection was retained`);
  assert(selection.canIssue === expectedCanIssue, `${label}: issue gate state was incorrect`);
  const hidden = hiddenValues(selection);
  assert(hidden.memberId === (expectedMemberId ?? "") && hidden.copyId === (expectedCopyId ?? ""), `${label}: hidden identity fields retained an invisible selection`);
};

let selection = reconcileIssueSelection(null, null, [member("A")], [copy("X")], true);
selection = reconcileIssueSelection("A", "X", [member("A")], [copy("X")], true);
assertSelection(selection, "A", "X", true, "initial explicit selection");

selection = reconcileIssueSelection(selection.selectedMemberId, selection.selectedCopyId, [member("B")], [copy("X")], true);
assertSelection(selection, null, "X", false, "member-only candidate navigation");

selection = reconcileIssueSelection("A", "X", [member("A")], [copy("Y")], true);
assertSelection(selection, "A", null, false, "copy-only candidate navigation");

selection = reconcileIssueSelection("A", "X", [member("B")], [copy("Y")], true);
assertSelection(selection, null, null, false, "member-and-copy candidate navigation");
selection = reconcileIssueSelection(selection.selectedMemberId, selection.selectedCopyId, [member("B")], [copy("Y")], true);
assertSelection(selection, null, null, false, "cleared navigation state");
selection = reconcileIssueSelection("B", "Y", [member("B")], [copy("Y")], true);
assertSelection(selection, "B", "Y", true, "new explicit selection after navigation");

console.log("Phase 7.1 explicit-selection UI contract passed: no first-result identity binding, explicit borrower/copy gates, stale-selection clearing, and server-backed search.");
