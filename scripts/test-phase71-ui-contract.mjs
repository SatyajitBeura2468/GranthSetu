import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/operator/circulation/page.tsx", import.meta.url), "utf8");
const form = await readFile(new URL("../src/app/operator/circulation/issue-book-form.tsx", import.meta.url), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(page.includes("<IssueBookForm") && !page.includes("members[0]?.member_id") && !page.includes("copies[0]?.copy_id"), "server page still binds issue identity to the first result");
assert(form.includes("selectedMemberId") && form.includes("selectedCopyId") && form.includes("disabled={!ready || !selectedMemberId || !selectedCopyId}"), "issue form is not gated on two explicit selections");
assert(form.includes("setSelectedMemberId(null)") && form.includes("setSelectedCopyId(null)"), "editing search terms does not clear stale selections");
assert(form.includes("router.push(buildSearchUrl"), "issue search is not server-backed through the circulation route");
console.log("Phase 7.1 explicit-selection UI contract passed: no first-result identity binding, explicit borrower/copy gates, stale-selection clearing, and server-backed search.");
