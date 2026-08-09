import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if ((!url.includes("127.0.0.1") && !url.includes("localhost") && !url.includes("kong")) || !anonKey || !serviceKey) throw new Error("Refusing Phase 7.1 integration tests outside local Supabase.");
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = "Phase71-Test-Password-2026!";
const token = crypto.randomUUID();
const createdMembers = [];
const createdSessions = [];
const createdUsers = [];
const createdProfiles = [];
let coverFixture = null;
let coverOtherFixture = null;
let coverOriginal = null;
let coverOtherOriginal = null;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

try {
  const user = await admin.auth.admin.createUser({ email: `phase71-${token}@phase71.invalid`, password, email_confirm: true });
  assert(!user.error && user.data.user, `fixture auth user failed: ${user.error?.message}`); createdUsers.push(user.data.user.id);
  const profile = await admin.from("profiles").insert({ auth_user_id: user.data.user.id, display_name: "Phase 7.1 Administrator", status: "active" }).select("id").single();
  assert(!profile.error, `fixture profile failed: ${profile.error?.message}`); createdProfiles.push(profile.data.id);
  const role = await admin.from("roles").select("id").eq("role_key", "administrator").single();
  assert(!role.error, "administrator role missing");
  const assignment = await admin.from("profile_roles").insert({ profile_id: profile.data.id, role_id: role.data.id }); assert(!assignment.error, `fixture role failed: ${assignment.error?.message}`);
  const signedIn = await client.auth.signInWithPassword({ email: `phase71-${token}@phase71.invalid`, password }); assert(!signedIn.error, `fixture sign-in failed: ${signedIn.error?.message}`);
  const currentStart = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
  const currentEnd = new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10);
  const session = await admin.from("academic_sessions").insert({ session_code: `PHASE71-CURRENT-${token}`, display_label: "Phase 7.1 current session", starts_on: currentStart, ends_on: currentEnd, status: "active" }).select("id").single();
  assert(!session.error, `current session fixture failed: ${session.error?.message}`); createdSessions.push(session.data.id);
  const grade = await admin.from("grade_levels").select("id").limit(1).single(); const section = await admin.from("sections").select("id").limit(1).single();
  assert(!grade.error && !section.error, "academic fixtures missing");
  const futureStart = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const futureEnd = new Date(Date.now() + 367 * 86400000).toISOString().slice(0, 10);
  const futureSession = await admin.from("academic_sessions").insert({ session_code: `PHASE71-FUTURE-${token}`, display_label: "Phase 7.1 future session", starts_on: futureStart, ends_on: futureEnd, status: "active" }).select("id").single();
  assert(!futureSession.error, `future session fixture failed: ${futureSession.error?.message}`); createdSessions.push(futureSession.data.id);

  const bulk = Array.from({ length: 125 }, (_, index) => ({ member_identifier: `PHASE71-BULK-${token}-${index}`, member_kind: "student", display_name: `Phase71Search ${index}`, status: "active" }));
  const inserted = await admin.from("members").insert(bulk).select("id"); assert(!inserted.error && inserted.data?.length === 125, `bulk member fixture failed: ${inserted.error?.message}`); createdMembers.push(...inserted.data.map((row) => row.id));
  const enrollments = createdMembers.map((id, index) => ({ member_id: id, academic_session_id: session.data.id, grade_level_id: grade.data.id, section_id: section.data.id, roll_number: String(1000 + index), status: "active" }));
  const enrolled = await admin.from("student_enrollments").insert(enrollments); assert(!enrolled.error, `bulk enrollment fixture failed: ${enrolled.error?.message}`);
  const search = await client.rpc("circulation_member_search", { p_query: "Phase71Search", p_limit: 500 }); assert(!search.error && search.data.length === 50, `search-first member result was not bounded at 50: ${search.error?.message ?? search.data?.length}`);
  const rollSearch = await client.rpc("circulation_member_search", { p_query: "1007", p_limit: 50 }); assert(!rollSearch.error && rollSearch.data.some((row) => row.roll_number === "1007"), "roll number was not searchable");

  const created = await Promise.all(Array.from({ length: 12 }, (_, index) => client.rpc("member_create_with_enrollment", { p_display_name: `Concurrent ${index}`, p_member_kind: "teacher", p_status: "active", p_academic_session_id: null, p_grade_level_id: null, p_section_id: null, p_roll_number: null, p_enrollment_status: "active" })));
  assert(created.every((result) => !result.error && typeof result.data === "string"), `concurrent atomic member creation failed: ${created.find((result) => result.error)?.error?.message}`); createdMembers.push(...created.map((result) => result.data));
  const ids = await admin.from("members").select("member_identifier").in("id", created.map((result) => result.data)); assert(!ids.error && new Set(ids.data.map((row) => row.member_identifier)).size === 12 && ids.data.every((row) => /^GS-\d{6}$/.test(row.member_identifier)), "generated member identifiers were not stable and collision-safe");
  const first = await client.rpc("member_create_with_enrollment", { p_display_name: "Duplicate roll one", p_member_kind: "student", p_status: "active", p_academic_session_id: session.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_roll_number: "4242", p_enrollment_status: "active" }); assert(!first.error, `first duplicate-roll fixture failed: ${first.error?.message}`); createdMembers.push(first.data);
  const second = await client.rpc("member_create_with_enrollment", { p_display_name: "Duplicate roll two", p_member_kind: "student", p_status: "active", p_academic_session_id: session.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_roll_number: " 4242 ", p_enrollment_status: "active" }); assert(second.error?.message.includes("GS_ROLL_DUPLICATE"), "duplicate active roll was not rejected");
  const futureCreation = await client.rpc("member_create_with_enrollment", { p_display_name: `Phase 7.1 rejected future student ${token}`, p_member_kind: "student", p_status: "active", p_academic_session_id: futureSession.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_roll_number: `FUTURE-CREATE-${token.slice(0, 12)}`, p_enrollment_status: "active" });
  assert(futureCreation.error?.message.includes("GS_ENROLLMENT_SESSION_NOT_CURRENT"), "student creation accepted an active future enrollment");
  const runtimeRoll = `RUNTIME-${token.slice(0, 16)}`;
  const runtimeStudent = await client.rpc("member_create_with_enrollment", { p_display_name: `Phase 7.1 current enrollment ${token}`, p_member_kind: "student", p_status: "active", p_academic_session_id: session.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_roll_number: runtimeRoll, p_enrollment_status: "active" });
  assert(!runtimeStudent.error && typeof runtimeStudent.data === "string", `runtime enrollment fixture failed: ${runtimeStudent.error?.message}`); createdMembers.push(runtimeStudent.data);
  const futureEnrollment = await client.rpc("member_set_enrollment_v71", { p_member_id: runtimeStudent.data, p_academic_session_id: futureSession.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_roll_number: `FUTURE-${token.slice(0, 16)}`, p_status: "active" });
  assert(futureEnrollment.error?.message.includes("GS_ENROLLMENT_SESSION_NOT_CURRENT"), "future active enrollment displaced the current eligible enrollment");
  const legacyEnrollment = await client.rpc("member_set_enrollment", { p_member_id: runtimeStudent.data, p_academic_session_id: futureSession.data.id, p_grade_level_id: grade.data.id, p_section_id: section.data.id, p_status: "active" });
  assert(legacyEnrollment.error, "legacy member_set_enrollment RPC remained callable by authenticated operators");
  const runtimeRows = await admin.from("student_enrollments").select("status,academic_session_id").eq("member_id", runtimeStudent.data);
  assert(!runtimeRows.error && runtimeRows.data.length === 1 && runtimeRows.data[0].status === "active" && runtimeRows.data[0].academic_session_id === session.data.id, "current enrollment was not preserved after rejecting future activation");
  const protectedMember = await admin.from("members").select("id,member_identifier,member_kind,display_name,status,updated_at").eq("id", createdMembers[0]).single();
  assert(!protectedMember.error, `legacy RPC fixture lookup failed: ${protectedMember.error?.message}`);
  const legacyMutation = await client.rpc("member_upsert", { p_id: protectedMember.data.id, p_member_identifier: `LEGACY-BYPASS-${token}`, p_member_kind: protectedMember.data.member_kind, p_display_name: protectedMember.data.display_name, p_status: protectedMember.data.status, p_expected_updated_at: protectedMember.data.updated_at });
  assert(legacyMutation.error, "legacy mutable member_upsert RPC remained callable by authenticated operators");
  const clearedPolicies = await admin.from("library_settings").delete().in("setting_key", ["default_loan_period_days", "checkout_limit", "renewal_limit"]); assert(!clearedPolicies.error, `required policy cleanup failed: ${clearedPolicies.error?.message}`);
  const incompleteContext = await client.rpc("operator_policy_context"); assert(!incompleteContext.error && incompleteContext.data?.[0]?.policy_ready === false, "policy context reported ready without required loan settings");
  for (const [settingKey, settingValue] of [["default_loan_period_days", 14], ["checkout_limit", 3], ["renewal_limit", 1]]) {
    const requiredSetting = await client.rpc("admin_upsert_setting", { p_setting_key: settingKey, p_boolean_value: null, p_integer_value: settingValue, p_money_minor_value: null }); assert(!requiredSetting.error, `${settingKey} policy setup failed: ${requiredSetting.error?.message}`);
  }
  const setting = await client.rpc("admin_upsert_setting", { p_setting_key: "overdue_renewal_allowed", p_boolean_value: true, p_integer_value: null, p_money_minor_value: null }); assert(!setting.error, `policy toggle failed: ${setting.error?.message}`);
  const context = await client.rpc("operator_policy_context"); assert(!context.error && context.data?.[0]?.policy_ready === true && context.data?.[0]?.overdue_renewal_allowed === true, "policy context did not reflect complete trusted settings");
  const coverBooks = await admin.from("books").select("id,cover_storage_path").eq("status", "active").order("id").limit(2); assert(!coverBooks.error && coverBooks.data?.length === 2, `cover race fixture lookup failed: ${coverBooks.error?.message ?? "two active books are required"}`);
  coverFixture = coverBooks.data[0].id; coverOriginal = coverBooks.data[0].cover_storage_path;
  coverOtherFixture = coverBooks.data[1].id; coverOtherOriginal = coverBooks.data[1].cover_storage_path;
  const coverPathA = `book-covers/${coverFixture}/phase71-${token}.jpg`; const coverPathB = `book-covers/${coverFixture}/phase71-${token}-next.jpg`; const coverOtherPath = `book-covers/${coverOtherFixture}/phase71-${token}.jpg`;
  const mismatchedCoverSet = await client.rpc("catalogue_set_book_cover_v71", { p_book_id: coverOtherFixture, p_cover_storage_path: coverPathA, p_expected_cover_storage_path: coverOtherOriginal }); assert(mismatchedCoverSet.error?.message.includes("GS_COVER_PATH_INVALID"), "cover path from another book was accepted");
  const coverReferences = await admin.from("books").select("id,cover_storage_path").in("id", [coverFixture, coverOtherFixture]); assert(!coverReferences.error && coverReferences.data.find((book) => book.id === coverFixture)?.cover_storage_path === coverOriginal && coverReferences.data.find((book) => book.id === coverOtherFixture)?.cover_storage_path === coverOtherOriginal, "cross-book cover rejection changed a book cover reference");
  const sharedLegacyPath = `book-covers/${coverFixture}/legacy-${token}.jpg`;
  const sharedLegacySeed = await admin.from("books").update({ cover_storage_path: sharedLegacyPath }).in("id", [coverFixture, coverOtherFixture]); assert(!sharedLegacySeed.error, `legacy shared-cover fixture failed: ${sharedLegacySeed.error?.message}`);
  const sharedCoverReplacement = await client.rpc("catalogue_set_book_cover_v71", { p_book_id: coverOtherFixture, p_cover_storage_path: coverOtherPath, p_expected_cover_storage_path: sharedLegacyPath }); assert(!sharedCoverReplacement.error && sharedCoverReplacement.data === sharedLegacyPath, `legacy shared-cover replacement failed: ${sharedCoverReplacement.error?.message}`);
  const sharedCoverReferences = await admin.from("books").select("id,cover_storage_path").in("id", [coverFixture, coverOtherFixture]); assert(!sharedCoverReferences.error && sharedCoverReferences.data.find((book) => book.id === coverFixture)?.cover_storage_path === sharedLegacyPath && sharedCoverReferences.data.find((book) => book.id === coverOtherFixture)?.cover_storage_path === coverOtherPath, "legacy shared cover reference was not preserved after replacement");
  const remainingSharedReference = await admin.from("books").select("id", { count: "exact", head: true }).eq("cover_storage_path", sharedLegacyPath); assert(!remainingSharedReference.error && remainingSharedReference.count === 1, "shared legacy path was not retained for the remaining book reference");
  const coverReset = await Promise.all([admin.from("books").update({ cover_storage_path: coverOriginal }).eq("id", coverFixture), admin.from("books").update({ cover_storage_path: coverOtherOriginal }).eq("id", coverOtherFixture)]); assert(coverReset.every((result) => !result.error), "cover fixtures could not be restored after the shared-reference regression");
  const clearedSharedReference = await admin.from("books").select("id", { count: "exact", head: true }).eq("cover_storage_path", sharedLegacyPath); assert(!clearedSharedReference.error && clearedSharedReference.count === 0, "shared legacy path remained referenced after fixture restoration");
  const coverSet = await client.rpc("catalogue_set_book_cover_v71", { p_book_id: coverFixture, p_cover_storage_path: coverPathA, p_expected_cover_storage_path: coverOriginal }); assert(!coverSet.error && coverSet.data === coverOriginal, `atomic cover set failed: ${coverSet.error?.message}`);
  const staleCoverSet = await client.rpc("catalogue_set_book_cover_v71", { p_book_id: coverFixture, p_cover_storage_path: coverPathB, p_expected_cover_storage_path: coverOriginal }); assert(staleCoverSet.error?.message.includes("GS_STALE_UPDATE"), "stale cover mutation was not rejected");
  const coverRestore = await client.rpc("catalogue_set_book_cover_v71", { p_book_id: coverFixture, p_cover_storage_path: coverOriginal, p_expected_cover_storage_path: coverPathA }); assert(!coverRestore.error && coverRestore.data === coverPathA, `cover race fixture restore failed: ${coverRestore.error?.message}`);
  const legacyCoverSet = await client.rpc("catalogue_set_book_cover", { p_book_id: coverFixture, p_cover_storage_path: coverPathB }); assert(legacyCoverSet.error, "legacy cover mutation remained callable by authenticated operators");
  coverFixture = null;
  console.log("Phase 7.1 integration passed: >100 member search regression, roll search and uniqueness, atomic concurrent identifier generation, policy context, cover cleanup race protection, and server-authorized member creation.");
} finally {
  await client.auth.signOut().catch(() => undefined);
  if (coverFixture) await admin.from("books").update({ cover_storage_path: coverOriginal }).eq("id", coverFixture);
  if (coverOtherFixture) await admin.from("books").update({ cover_storage_path: coverOtherOriginal }).eq("id", coverOtherFixture);
  if (createdMembers.length) { await admin.from("student_enrollments").delete().in("member_id", createdMembers); await admin.from("members").delete().in("id", createdMembers); }
  if (createdSessions.length) await admin.from("academic_sessions").delete().in("id", createdSessions);
  if (createdProfiles.length) { await admin.from("profile_roles").delete().in("profile_id", createdProfiles); await admin.from("profiles").delete().in("id", createdProfiles); }
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
