import { readFile } from "node:fs/promises";
import { reconcileIssueSelection } from "../src/app/operator/circulation/issue-book-selection.mjs";

const page = await readFile(new URL("../src/app/operator/circulation/page.tsx", import.meta.url), "utf8");
const workspacePage = await readFile(new URL("../src/app/operator/page.tsx", import.meta.url), "utf8");
const form = await readFile(new URL("../src/app/operator/circulation/issue-book-form.tsx", import.meta.url), "utf8");
const reports = await readFile(new URL("../src/app/operator/reports/page.tsx", import.meta.url), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(page.includes("<IssueBookForm") && !page.includes("members[0]?.member_id") && !page.includes("copies[0]?.copy_id"), "server page still binds issue identity to the first result");
assert(form.includes("selectedMemberId") && form.includes("selectedCopyId") && form.includes("disabled={!visibleSelection.canIssue}"), "issue form is not gated on two explicit visible selections");
assert(form.includes("setSelectedMemberId(null)") && form.includes("setSelectedCopyId(null)"), "editing search terms does not clear stale selections");
assert(form.includes("router.push(buildSearchUrl"), "issue search is not server-backed through the circulation route");
assert(form.includes("reconcileIssueSelection") && form.includes("visibleSelection.selectedMemberId") && form.includes("visibleSelection.selectedCopyId"), "candidate lifecycle reconciliation is not wired into rendered selection and hidden fields");
assert(page.includes("key={issueCandidateContextKey}") && page.includes("params.member ?? \"\"") && page.includes("params.copy ?? \"\""), "candidate context changes do not remount the issue form");
assert(reports.includes("function exportQuery") && reports.includes("kind === \"overdue\"") && reports.includes("kind !== \"popular\" && kind !== \"inventory\""), "report filters are not constrained to the supported report arguments");
assert(workspacePage.includes('result_type === "copy"') && workspacePage.includes('/operator/inventory/${result.result_id}'), "global search copy results do not route to the selected inventory record");

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
