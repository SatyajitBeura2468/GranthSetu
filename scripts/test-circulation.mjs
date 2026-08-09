import { createClient } from "@supabase/supabase-js";

// Disposable local-only behavioural coverage. Never point this at hosted Supabase.
const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if ((!url.includes("127.0.0.1") && !url.includes("localhost") && !url.includes("kong")) || !anonKey || !serviceKey) {
  throw new Error("Refusing circulation tests outside local Supabase.");
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = "Phase5-Test-Password-2026!";
const libraryCode = "OAVMUSI";
const libraryId = "10000000-0000-0000-0000-000000000001";
const createdUsers = [];
const createdProfiles = [];
const createdCopies = [];
const createdMembers = [];
const createdLoans = [];
const createdFines = [];
const clients = [];

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const expectError = async (operation, message) => { const result = await operation(); assert(result.error, message); return result; };
const id = () => crypto.randomUUID();
const userClient = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const rpc = async (client, name, args) => client.rpc(name, args);
const rows = async (table, query) => { const result = await query; assert(!result.error, `${table} query failed: ${result.error?.message}`); return result.data; };

async function operator(label, roleKey, metadata) {
  const email = `phase5-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@phase5.invalid`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  assert(!created.error && created.data.user, `could not create ${label}: ${created.error?.message}`);
  const profile = await admin.from("profiles").insert({ auth_user_id: created.data.user.id, display_name: `Phase 5 ${label}`, status: "active" }).select("id").single();
  assert(!profile.error, `could not create ${label} profile: ${profile.error?.message}`);
  const role = await admin.from("roles").select("id").eq("role_key", roleKey).single();
  const assignment = await admin.from("profile_roles").insert({ profile_id: profile.data.id, library_id: libraryId, role_id: role.data.id });
  assert(!assignment.error, `could not assign ${label} role: ${assignment.error?.message}`);
  const client = userClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert(!signedIn.error, `${label} sign-in failed: ${signedIn.error?.message}`);
  createdUsers.push(created.data.user); createdProfiles.push(profile.data.id); clients.push(client);
  return { auth: created.data.user, profileId: profile.data.id, client };
}

async function member(kind, status = "active") {
  const result = await admin.from("members").insert({ library_id: libraryId, member_identifier: `PHASE5-M-${Date.now()}-${Math.random().toString(16).slice(2)}`, member_kind: kind, display_name: `Phase 5 ${kind}`, status }).select("id").single();
  assert(!result.error, `member fixture failed: ${result.error?.message}`); createdMembers.push(result.data.id); return result.data.id;
}

async function copy(bookId, state = "active") {
  const result = await admin.from("book_copies").insert({ library_id: libraryId, book_id: bookId, accession_number: `PHASE5-C-${Date.now()}-${Math.random().toString(16).slice(2)}`, operational_state: state }).select("id").single();
  assert(!result.error, `copy fixture failed: ${result.error?.message}`); createdCopies.push(result.data.id); return result.data.id;
}

async function policy(values) {
  const payload = Object.entries(values).map(([setting_key, value]) => value.kind === "boolean" ? { library_id: libraryId, setting_key, value_kind: "boolean", boolean_value: value.value } : value.kind === "money" ? { library_id: libraryId, setting_key, value_kind: "money_minor", money_minor_value: value.value, currency_code: "INR" } : { library_id: libraryId, setting_key, value_kind: "integer", integer_value: value.value });
  const result = await admin.from("library_settings").upsert(payload, { onConflict: "library_id,setting_key" }); assert(!result.error, `policy fixture failed: ${result.error?.message}`);
}

async function fixtureLoan({ memberId, copyId, returned = false, overdue = false, issuedBy }) {
  const now = new Date();
  const issuedAt = overdue ? "2026-07-01T09:00:00Z" : now.toISOString();
  const dueAt = overdue ? "2026-07-02T09:00:00Z" : new Date(now.getTime() + 14 * 86400000).toISOString();
  const result = await admin.from("loans").insert({ library_id: libraryId, member_id: memberId, book_copy_id: copyId, issued_at: issuedAt, due_at: dueAt, returned_at: returned ? (overdue ? "2026-07-05T09:00:00Z" : new Date(now.getTime() + 86400000).toISOString()) : null, issued_by_profile_id: issuedBy, returned_by_profile_id: returned ? issuedBy : null, status: returned ? "returned" : "active" }).select("id, issued_at, due_at").single();
  assert(!result.error, `loan fixture failed: ${result.error?.message}`); createdLoans.push(result.data.id); return result.data;
}

async function fine(loanId, amount = 1000) {
  const result = await admin.from("fines").insert({ library_id: libraryId, loan_id: loanId, assessed_amount_minor: amount, fine_kind: "overdue", assessed_by_profile_id: createdProfiles[0] }).select("id").single();
  assert(!result.error, `fine fixture failed: ${result.error?.message}`); createdFines.push(result.data.id); return result.data.id;
}

async function assertNoAudit(requestId) {
  const result = await admin.from("audit_events").select("id").eq("request_id", requestId);
  assert(!result.error && result.data.length === 0, `failed request ${requestId} created a success audit`);
}

try {
  const adminOp = await operator("administrator", "administrator", { role: "administrator", is_admin: true });
  const librarian = await operator("librarian", "librarian", { role: "administrator", is_admin: true, roles: ["administrator"] });
  const inactive = await operator("inactive", "librarian", {});
  const noRole = await operator("unmapped", "librarian", {});
  await admin.from("profile_roles").delete().eq("profile_id", noRole.profileId);
  await admin.from("profiles").update({ status: "inactive" }).eq("id", inactive.profileId);

  await policy({ default_loan_period_days: { value: 14, kind: "integer" }, checkout_limit: { value: 3, kind: "integer" }, renewal_limit: { value: 1, kind: "integer" }, fines_enabled: { value: false, kind: "boolean" } });
  const bookRow = await rows("books", admin.from("books").select("id,title").eq("status", "active").limit(1).single());
  const book = bookRow.id;
  const activeBookTitle = bookRow.title;
  const archivedResult = await admin.from("books").select("id").eq("status", "archived").limit(1).maybeSingle();
  const archivedBook = archivedResult.error ? null : archivedResult.data?.id;
  const activeMember = await member("teacher");
  const inactiveMember = await member("teacher", "inactive");
  const studentWithoutEnrollment = await member("student");

  // The omitted report cutoff is the current instant; an explicit date remains end-of-day inclusive.
  const todayCutoffLoan = await fixtureLoan({ memberId: activeMember, copyId: await copy(book), issuedBy: librarian.profileId });
  const dueLaterToday = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const todayCutoffUpdate = await admin.from("loans").update({ due_at: dueLaterToday }).eq("id", todayCutoffLoan.id); assert(!todayCutoffUpdate.error, `today cutoff fixture update failed: ${todayCutoffUpdate.error?.message}`);
  const defaultOverdueReport = await librarian.client.rpc("report_overdue_filtered", { p_as_of: null, p_query: null });
  assert(!defaultOverdueReport.error && !defaultOverdueReport.data.some((row) => row.loan_id === todayCutoffLoan.id), "default overdue report included a loan due later today");
  // Tie the explicit end-of-day cutoff to the fixture's UTC due date if CI crosses midnight.
  const explicitOverdueReport = await librarian.client.rpc("report_overdue_filtered", { p_as_of: dueLaterToday.slice(0, 10), p_query: null });
  assert(!explicitOverdueReport.error && explicitOverdueReport.data.some((row) => row.loan_id === todayCutoffLoan.id), "explicit end-of-day overdue report omitted today's cutoff loan");
  const globalLoanSearch = await librarian.client.rpc("global_search_v71", { p_query: activeBookTitle });
  assert(!globalLoanSearch.error && globalLoanSearch.data.some((row) => row.result_type === "loan" && row.result_id === todayCutoffLoan.id), "global search omitted the active loan result");
  const filteredInventory = await librarian.client.rpc("report_inventory_filtered", { p_status: "lost", p_location_id: null });
  assert(!filteredInventory.error && filteredInventory.data.length > 0 && filteredInventory.data.every((row) => row.total_copies > 0), "inventory status filter retained books without matching copies");

  // Issue: success, server ownership, audit, retry, cross-operation reuse.
  const issueCopy = await copy(book); const issueRequest = id();
  const issue = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: issueCopy, p_request_id: issueRequest, p_notes: "synthetic" });
  assert(!issue.error && issue.data?.status === "active", `issue failed: ${issue.error?.message}`); createdLoans.push(issue.data.loan_id);
  assert(issue.data.member_id === activeMember && issue.data.copy_id === issueCopy, "issue result ownership mismatch");
  const issueRetry = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: issueCopy, p_request_id: issueRequest });
  assert(!issueRetry.error && issueRetry.data?.idempotent === true, "issue retry was not idempotent");
  const issueAudit = await rows("audit", admin.from("audit_events").select("id, action, actor_profile_id").eq("request_id", issueRequest));
  assert(issueAudit.length === 1 && issueAudit[0].action === "circulation.loan_issued" && issueAudit[0].actor_profile_id === librarian.profileId, "issue audit attribution failed");
  await expectError(() => librarian.client.rpc("circulation_return_loan", { p_loan_id: issue.data.loan_id, p_request_id: issueRequest }), "cross-operation request reuse succeeded");

  // Issue validation and failed-operation audit guarantees.
  for (const [memberId, code] of [[inactiveMember, "inactive"], [studentWithoutEnrollment, "enrolment"]]) {
    const request = id(); const result = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: memberId, p_book_copy_id: await copy(book), p_request_id: request });
    assert(result.error && result.error.message.includes("GS_"), `${code} member issue did not fail with a domain error`); await assertNoAudit(request);
  }
  const missingPolicyRequest = id(); await admin.from("library_settings").delete().eq("setting_key", "checkout_limit");
  const missingPolicy = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: await copy(book), p_request_id: missingPolicyRequest });
  assert(missingPolicy.error?.message.includes("GS_POLICY_NOT_CONFIGURED"), "missing policy did not fail closed"); await assertNoAudit(missingPolicyRequest);
  await policy({ checkout_limit: { value: 3, kind: "integer" } });
  for (const state of ["maintenance", "lost", "damaged", "withdrawn"]) { const request = id(); const result = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: await copy(book, state), p_request_id: request }); assert(result.error?.message.includes("GS_COPY_NOT_CIRCULATABLE"), `${state} copy was issued`); await assertNoAudit(request); }
  if (archivedBook) { const request = id(); const result = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: await copy(archivedBook), p_request_id: request }); assert(result.error?.message.includes("GS_BOOK_ARCHIVED"), "archived book was issued"); await assertNoAudit(request); }

  // Real concurrent issue race and member checkout-limit race.
  const raceCopy = await copy(book); const raceMember = await member("teacher");
  const issueRace = await Promise.allSettled([rpc(librarian.client, "circulation_issue_loan", { p_member_id: raceMember, p_book_copy_id: raceCopy, p_request_id: id() }), rpc(adminOp.client, "circulation_issue_loan", { p_member_id: raceMember, p_book_copy_id: raceCopy, p_request_id: id() })]);
  assert(issueRace.filter((result) => result.status === "fulfilled" && !result.value.error).length === 1, "double-issue concurrency did not produce exactly one success");
  const raceLoans = await rows("race loans", admin.from("loans").select("id").eq("book_copy_id", raceCopy).eq("status", "active")); assert(raceLoans.length === 1, "double-issue race left multiple active loans"); createdLoans.push(raceLoans[0].id);
  await policy({ checkout_limit: { value: 1, kind: "integer" } });
  const limitMember = await member("teacher"); const limitRace = await Promise.allSettled([rpc(librarian.client, "circulation_issue_loan", { p_member_id: limitMember, p_book_copy_id: await copy(book), p_request_id: id() }), rpc(adminOp.client, "circulation_issue_loan", { p_member_id: limitMember, p_book_copy_id: await copy(book), p_request_id: id() })]);
  assert(limitRace.filter((result) => result.status === "fulfilled" && !result.value.error).length === 1, "checkout-limit concurrency exceeded one loan");
  await policy({ checkout_limit: { value: 3, kind: "integer" } });

  // Return lifecycle, including later member/copy state changes.
  const returnCopy = await copy(book); const returnMember = await member("teacher"); const returnLoan = await fixtureLoan({ memberId: returnMember, copyId: returnCopy, issuedBy: librarian.profileId });
  await admin.from("members").update({ status: "inactive" }).eq("id", returnMember); await admin.from("book_copies").update({ operational_state: "damaged" }).eq("id", returnCopy);
  const returnRequest = id(); const returned = await rpc(librarian.client, "circulation_return_loan", { p_loan_id: returnLoan.id, p_request_id: returnRequest }); assert(!returned.error && returned.data.status === "returned", `return after state changes failed: ${returned.error?.message}`);
  const returnRetry = await rpc(librarian.client, "circulation_return_loan", { p_loan_id: returnLoan.id, p_request_id: returnRequest }); assert(!returnRetry.error && returnRetry.data.idempotent === true, "return retry was not idempotent");
  const returnAgain = await rpc(librarian.client, "circulation_return_loan", { p_loan_id: returnLoan.id, p_request_id: id() }); assert(returnAgain.error?.message.includes("GS_LOAN_ALREADY_RETURNED"), "returned loan reopened");

  // Renewal success, retry, overdue/lifecycle rejection, and concurrent limit.
  await admin.from("members").update({ status: "active" }).eq("id", returnMember); await admin.from("book_copies").update({ operational_state: "active" }).eq("id", returnCopy);
  const renewCopy = await copy(book); const renewMember = await member("teacher"); const renewLoan = await (async () => { const result = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: renewMember, p_book_copy_id: renewCopy, p_request_id: id() }); assert(!result.error, `renew fixture issue failed: ${result.error?.message}`); createdLoans.push(result.data.loan_id); return result.data; })();
  const renewRequest = id(); const renewed = await rpc(librarian.client, "circulation_renew_loan", { p_loan_id: renewLoan.loan_id, p_request_id: renewRequest }); assert(!renewed.error && renewed.data.new_due_at, `renew failed: ${renewed.error?.message}`);
  const renewRetry = await rpc(librarian.client, "circulation_renew_loan", { p_loan_id: renewLoan.loan_id, p_request_id: renewRequest }); assert(!renewRetry.error && renewRetry.data.idempotent === true, "renew retry was not idempotent");
  const renewLimit = await rpc(librarian.client, "circulation_renew_loan", { p_loan_id: renewLoan.loan_id, p_request_id: id() }); assert(renewLimit.error?.message.includes("GS_RENEWAL_LIMIT_REACHED"), "renewal limit was bypassed");
  const overdueCopy = await copy(book); const overdueMember = await member("teacher"); const overdueLoan = await fixtureLoan({ memberId: overdueMember, copyId: overdueCopy, returned: false, overdue: true, issuedBy: librarian.profileId });
  const loanSearch = await librarian.client.rpc("operator_circulation_search", { p_library_code: libraryCode, p_kind: "loans", p_query: activeBookTitle });
  assert(!loanSearch.error && Array.isArray(loanSearch.data) && loanSearch.data.some((row) => row.id === todayCutoffLoan.id && row.overdue === false) && loanSearch.data.some((row) => row.id === overdueLoan.id && row.overdue === true), "room-scoped circulation loan search did not expose authoritative overdue status");
  await policy({ overdue_renewal_allowed: { value: true, kind: "boolean" } });
  const allowedOverdueCopy = await copy(book); const allowedOverdueMember = await member("teacher"); const allowedOverdueLoan = await fixtureLoan({ memberId: allowedOverdueMember, copyId: allowedOverdueCopy, returned: false, overdue: true, issuedBy: librarian.profileId });
  const allowedOverdueRenew = await rpc(librarian.client, "circulation_renew_loan", { p_loan_id: allowedOverdueLoan.id, p_request_id: id() });
  assert(!allowedOverdueRenew.error && new Date(allowedOverdueRenew.data.new_due_at).getTime() > Date.now(), "overdue renewal did not establish a future due date");
  await policy({ overdue_renewal_allowed: { value: false, kind: "boolean" } });
  const overdueRenew = await rpc(librarian.client, "circulation_renew_loan", { p_loan_id: overdueLoan.id, p_request_id: id() }); assert(overdueRenew.error?.message.includes("GS_LOAN_OVERDUE"), "overdue renewal succeeded");
  const concurrentRenewCopy = await copy(book); const concurrentRenewMember = await member("teacher"); const concurrentLoan = await (async () => { const result = await rpc(librarian.client, "circulation_issue_loan", { p_member_id: concurrentRenewMember, p_book_copy_id: concurrentRenewCopy, p_request_id: id() }); assert(!result.error, "concurrent renewal fixture failed"); createdLoans.push(result.data.loan_id); return result.data; })();
  const renewRace = await Promise.allSettled([rpc(librarian.client, "circulation_renew_loan", { p_loan_id: concurrentLoan.loan_id, p_request_id: id() }), rpc(adminOp.client, "circulation_renew_loan", { p_loan_id: concurrentLoan.loan_id, p_request_id: id() })]); assert(renewRace.filter((result) => result.status === "fulfilled" && !result.value.error).length === 1, "renewal concurrency exceeded the limit");

  // Fine disabled, no-fine, calculated overdue, duplicate, settlement, waiver, and metadata attack.
  const noFineLoan = await fixtureLoan({ memberId: await member("teacher"), copyId: await copy(book), returned: true, issuedBy: librarian.profileId }); const disabled = await rpc(librarian.client, "circulation_assess_overdue_fine", { p_loan_id: noFineLoan.id, p_request_id: id() }); assert(!disabled.error && disabled.data.code === "GS_FINES_DISABLED", "disabled fines created a charge");
  await policy({ fines_enabled: { value: true, kind: "boolean" }, grace_period_days: { value: 1, kind: "integer" }, daily_fine_rate_minor: { value: 100, kind: "money" } });
  const noDueLoan = await fixtureLoan({ memberId: await member("teacher"), copyId: await copy(book), returned: true, issuedBy: librarian.profileId }); const noFine = await rpc(librarian.client, "circulation_assess_overdue_fine", { p_loan_id: noDueLoan.id, p_request_id: id() }); assert(!noFine.error && noFine.data.code === "GS_NO_FINE_DUE", "non-overdue loan received a fine");
  const overdueReturned = await fixtureLoan({ memberId: await member("teacher"), copyId: await copy(book), returned: true, overdue: true, issuedBy: librarian.profileId }); const fineResult = await rpc(librarian.client, "circulation_assess_overdue_fine", { p_loan_id: overdueReturned.id, p_request_id: id() }); assert(!fineResult.error && fineResult.data.assessed_amount_minor > 0, `overdue fine failed: ${fineResult.error?.message}`); createdFines.push(fineResult.data.fine_id);
  const duplicateFine = await rpc(librarian.client, "circulation_assess_overdue_fine", { p_loan_id: overdueReturned.id, p_request_id: id() }); assert(duplicateFine.error?.message.includes("GS_FINE_ALREADY_ASSESSED"), "duplicate automated fine succeeded");
  const settleRequest = id(); const settled = await rpc(librarian.client, "circulation_settle_fine", { p_fine_id: fineResult.data.fine_id, p_amount_minor: 100, p_request_id: settleRequest, p_note: "cash" }); assert(!settled.error && settled.data.amount_settled_minor === 100, "fine settlement failed"); const settleRetry = await rpc(librarian.client, "circulation_settle_fine", { p_fine_id: fineResult.data.fine_id, p_amount_minor: 100, p_request_id: settleRequest, p_note: "cash" }); assert(!settleRetry.error && settleRetry.data.idempotent === true, "settlement retry was not idempotent");
  await policy({ librarian_waiver_allowed: { value: false, kind: "boolean" } }); const deniedWaiver = await rpc(librarian.client, "circulation_waive_fine", { p_fine_id: fineResult.data.fine_id, p_amount_minor: 100, p_request_id: id(), p_reason: "test" }); assert(deniedWaiver.error?.message.includes("GS_WAIVER_NOT_ALLOWED"), "librarian waiver policy was bypassed");
  await policy({ librarian_waiver_allowed: { value: true, kind: "boolean" } }); const waived = await rpc(librarian.client, "circulation_waive_fine", { p_fine_id: fineResult.data.fine_id, p_amount_minor: 100, p_request_id: id(), p_reason: "approved" }); assert(!waived.error && waived.data.amount_waived_minor === 100, "allowed librarian waiver failed");

  // JWT/user_metadata role forgery remains irrelevant.
  const forged = userClient(); const forgedEmail = `forged-${Date.now()}@phase5.invalid`; const forgedCreated = await admin.auth.admin.createUser({ email: forgedEmail, password, email_confirm: true, user_metadata: { role: "administrator", is_admin: true, roles: ["administrator"] } }); createdUsers.push(forgedCreated.data.user); await forged.auth.signInWithPassword({ email: forgedEmail, password }); const forgedRequest = id(); const forgedIssue = await forged.rpc("circulation_issue_loan", { p_member_id: activeMember, p_book_copy_id: await copy(book), p_request_id: forgedRequest }); assert(forgedIssue.error, "forged metadata gained circulation capability"); await assertNoAudit(forgedRequest); await forged.auth.signOut();

  console.log("Circulation integration tests passed: issue, return, renewal, overdue, fines, concurrency, idempotency, audit, and metadata-forgery cases.");
} finally {
  for (const client of clients) await client.auth.signOut().catch(() => {});
  await admin.from("fines").delete().in("id", createdFines);
  await admin.from("loan_renewals").delete().in("loan_id", createdLoans);
  await admin.from("loans").delete().in("id", createdLoans);
  await admin.from("book_copies").delete().in("id", createdCopies);
  await admin.from("members").delete().in("id", createdMembers);
  await admin.from("profile_roles").delete().in("profile_id", createdProfiles);
  await admin.from("profiles").delete().in("id", createdProfiles);
  for (const user of createdUsers) await admin.auth.admin.deleteUser(user.id).catch(() => {});
}
