import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if ((!url.includes("127.0.0.1") && !url.includes("localhost") && !url.includes("kong")) || !anonKey || !serviceKey) throw new Error("Refusing Phase 7.1 integration tests outside local Supabase.");
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = "Phase71-Test-Password-2026!";
const token = crypto.randomUUID();
const createdMembers = [];
const createdUsers = [];
const createdProfiles = [];
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
  const session = await admin.from("academic_sessions").select("id").eq("status", "active").limit(1).single(); const grade = await admin.from("grade_levels").select("id").limit(1).single(); const section = await admin.from("sections").select("id").limit(1).single();
  assert(!session.error && !grade.error && !section.error, "academic fixtures missing");

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
  const setting = await client.rpc("admin_upsert_setting", { p_setting_key: "overdue_renewal_allowed", p_boolean_value: true, p_integer_value: null, p_money_minor_value: null }); assert(!setting.error, `policy toggle failed: ${setting.error?.message}`);
  const context = await client.rpc("operator_policy_context"); assert(!context.error && context.data?.[0]?.overdue_renewal_allowed === true, "policy context did not reflect the trusted setting");
  console.log("Phase 7.1 integration passed: >100 member search regression, roll search and uniqueness, atomic concurrent identifier generation, policy context, and server-authorized member creation.");
} finally {
  await client.auth.signOut().catch(() => undefined);
  if (createdMembers.length) { await admin.from("student_enrollments").delete().in("member_id", createdMembers); await admin.from("members").delete().in("id", createdMembers); }
  if (createdProfiles.length) { await admin.from("profile_roles").delete().in("profile_id", createdProfiles); await admin.from("profiles").delete().in("id", createdProfiles); }
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
