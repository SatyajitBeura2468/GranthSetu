import { createClient } from "@supabase/supabase-js";

// The suite uses only disposable local identities and synthetic rows.
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if ((!url.includes("127.0.0.1") && !url.includes("localhost")) || !anonKey || !serviceKey) {
  throw new Error("Refusing circulation tests outside local Supabase.");
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const user = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `phase5-circulation-${Date.now()}@phase5.invalid`;
const password = "Phase5-Test-Password-2026!";
let authUser;
let profileId;
let copyId;
let loanId;

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const expectError = async (operation, message) => { const result = await operation(); assert(result.error, message); };

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "administrator", is_admin: true } });
  assert(!created.error && created.data.user, `could not create disposable circulation user: ${created.error?.message}`);
  authUser = created.data.user;
  const profile = await admin.from("profiles").insert({ auth_user_id: authUser.id, display_name: "Phase 5 Circulation Tester", status: "active" }).select("id").single();
  assert(!profile.error, `could not create circulation profile: ${profile.error?.message}`); profileId = profile.data.id;
  const role = await admin.from("roles").select("id").eq("role_key", "librarian").single();
  await admin.from("profile_roles").insert({ profile_id: profileId, role_id: role.data.id });
  const settings = [
    { setting_key: "default_loan_period_days", value_kind: "integer", integer_value: 14 },
    { setting_key: "checkout_limit", value_kind: "integer", integer_value: 3 },
    { setting_key: "renewal_limit", value_kind: "integer", integer_value: 1 },
    { setting_key: "fines_enabled", value_kind: "boolean", boolean_value: false },
  ];
  const settingResult = await admin.from("library_settings").upsert(settings); assert(!settingResult.error, `could not configure synthetic policy: ${settingResult.error?.message}`);
  const book = await admin.from("books").select("id").limit(1).single(); const location = await admin.from("locations").select("id").limit(1).single();
  const copy = await admin.from("book_copies").insert({ book_id: book.data.id, accession_number: `PHASE5-${Date.now()}`, location_id: location.data.id, operational_state: "active" }).select("id").single();
  assert(!copy.error, `could not create synthetic copy: ${copy.error?.message}`); copyId = copy.data.id;
  const member = await admin.from("members").select("id").eq("member_kind", "teacher").limit(1).single(); assert(!member.error, "synthetic teacher member missing");
  const signedIn = await user.auth.signInWithPassword({ email, password }); assert(!signedIn.error, `circulation test sign-in failed: ${signedIn.error?.message}`);

  const requestId = crypto.randomUUID();
  const issue = await user.rpc("circulation_issue_loan", { p_member_id: member.data.id, p_book_copy_id: copyId, p_request_id: requestId, p_notes: "synthetic test" });
  assert(!issue.error && issue.data?.loan_id, `issue RPC failed: ${issue.error?.message}`); loanId = issue.data.loan_id;
  const retry = await user.rpc("circulation_issue_loan", { p_member_id: member.data.id, p_book_copy_id: copyId, p_request_id: requestId, p_notes: "synthetic test" });
  assert(!retry.error && retry.data?.idempotent === true && retry.data.loan_id === loanId, "issue idempotency failed");
  await expectError(() => user.from("loans").update({ notes: "forged" }).eq("id", loanId), "direct loan update unexpectedly succeeded");
  const returnRequestId = crypto.randomUUID();
  const returned = await user.rpc("circulation_return_loan", { p_loan_id: loanId, p_request_id: returnRequestId }); assert(!returned.error && returned.data?.status === "returned", `return RPC failed: ${returned.error?.message}`);
  const returnRetry = await user.rpc("circulation_return_loan", { p_loan_id: loanId, p_request_id: returnRequestId });
  assert(!returnRetry.error && returnRetry.data?.idempotent === true, "return idempotency failed");
  const audit = await admin.from("audit_events").select("action").eq("target_id", loanId); assert(!audit.error && audit.data.some((row) => row.action === "circulation.loan_issued") && audit.data.some((row) => row.action === "circulation.loan_returned"), "circulation audit attribution missing");
  console.log("Circulation integration tests passed: trusted issue, issue idempotency, direct-DML denial, return, and audit.");
} finally {
  if (loanId) await admin.from("loans").delete().eq("id", loanId);
  if (copyId) await admin.from("book_copies").delete().eq("id", copyId);
  if (profileId) { await admin.from("profile_roles").delete().eq("profile_id", profileId); await admin.from("profiles").delete().eq("id", profileId); }
  if (authUser) await admin.auth.admin.deleteUser(authUser.id);
}
