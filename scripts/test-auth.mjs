import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  throw new Error("Local Supabase ANON_KEY and SERVICE_ROLE_KEY are required for auth integration tests.");
}

const password = "Phase4-Test-Password-2026!";
const suffix = "@phase4.invalid";
const identities = [
  { label: "administrator-a", displayName: "Development Administrator A", status: "active", role: "administrator", metadata: { role: "administrator", is_admin: true } },
  { label: "administrator-b", displayName: "Development Administrator B", status: "active", role: "administrator", metadata: { role: "administrator", is_admin: true } },
  { label: "librarian", displayName: "Development Librarian", status: "active", role: "librarian", metadata: { role: "administrator", is_admin: true } },
  { label: "inactive", displayName: "Inactive Operator", status: "inactive", role: "librarian", metadata: {} },
  { label: "no-role", displayName: "Unassigned Operator", status: "active", role: null, metadata: {} },
  { label: "unmapped", displayName: null, status: null, role: null, metadata: {} },
];

const admin = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const clients = new Map();
const createdUsers = [];
const createdProfiles = [];

function emailFor(label) {
  return `phase4-${label}${suffix}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function userClient() {
  return createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function expectError(operation, message) {
  const result = await operation();
  assert(result.error, message);
  return result;
}

async function signIn(user) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
  assert(!error && data.session, `sign-in failed for ${user.label}: ${error?.message ?? "unknown error"}`);
  clients.set(user.label, client);
  return client;
}

async function createFixtureUsers() {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert(!listError, "could not list disposable local Auth users");
  for (const existing of listed.users.filter((user) => user.email?.endsWith(suffix))) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  for (const identity of identities) {
    const email = emailFor(identity.label);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: identity.metadata,
    });
    assert(!error && data.user, `could not create disposable Auth user ${identity.label}: ${error?.message ?? "unknown error"}`);
    const user = { ...identity, email, id: data.user.id };
    createdUsers.push(user);
  }

  const profiles = createdUsers.filter((user) => user.displayName).map((user) => ({
    auth_user_id: user.id,
    display_name: user.displayName,
    status: user.status,
  }));
  const { error: profileInsertError } = await admin.from("profiles").insert(profiles);
  assert(!profileInsertError, `could not create disposable application profiles: ${profileInsertError?.message ?? "unknown error"}`);
  const { data, error } = await admin.from("profiles").select("id,auth_user_id").in("auth_user_id", profiles.map((profile) => profile.auth_user_id));
  assert(!error && data?.length === profiles.length, `could not read disposable application profiles: ${error?.message ?? "unknown error"}`);
  for (const profile of data) {
    const user = createdUsers.find((candidate) => candidate.id === profile.auth_user_id);
    user.profileId = profile.id;
    createdProfiles.push(profile.id);
  }

  const { data: roles, error: roleError } = await admin.from("roles").select("id,role_key");
  assert(!roleError, "could not read fixed operator roles");
  const roleIds = new Map(roles.map((role) => [role.role_key, role.id]));
  const assignments = createdUsers.filter((user) => user.role).map((user) => ({
    profile_id: user.profileId,
    role_id: roleIds.get(user.role),
  }));
  const { error: assignmentError } = await admin.from("profile_roles").insert(assignments);
  assert(!assignmentError, "could not create disposable role assignments");
}

async function cleanup() {
  for (const client of clients.values()) await client.auth.signOut().catch(() => undefined);
  if (createdProfiles.length) {
    await admin.from("profile_roles").delete().in("profile_id", createdProfiles);
    await admin.from("profiles").delete().in("id", createdProfiles);
  }
  for (const user of createdUsers) await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
}

try {
  await createFixtureUsers();
  const adminA = createdUsers.find((user) => user.label === "administrator-a");
  const adminB = createdUsers.find((user) => user.label === "administrator-b");
  const librarian = createdUsers.find((user) => user.label === "librarian");
  const inactive = createdUsers.find((user) => user.label === "inactive");
  const noRole = createdUsers.find((user) => user.label === "no-role");
  const unmapped = createdUsers.find((user) => user.label === "unmapped");
  const adminAClient = await signIn(adminA);
  const adminBClient = await signIn(adminB);
  const librarianClient = await signIn(librarian);
  const inactiveClient = await signIn(inactive);
  const noRoleClient = await signIn(noRole);
  const unmappedClient = await signIn(unmapped);
  const anonymous = userClient();

  const { error: signUpError } = await anonymous.auth.signUp({ email: `phase4-signup${suffix}`, password });
  assert(signUpError, "public signup unexpectedly succeeded");

  await expectError(() => anonymous.from("members").select("id"), "anonymous member read unexpectedly succeeded");

  const { data: adminContext, error: adminContextError } = await adminAClient.rpc("current_operator_context");
  assert(!adminContextError && adminContext?.[0]?.roles?.includes("administrator"), "administrator context did not resolve");
  const { data: librarianContext, error: librarianContextError } = await librarianClient.rpc("current_operator_context");
  assert(!librarianContextError && librarianContext?.[0]?.roles?.includes("librarian"), "librarian context did not resolve");
  const { data: unmappedContext, error: unmappedContextError } = await unmappedClient.rpc("current_operator_context");
  assert(!unmappedContextError && (!unmappedContext || unmappedContext.length === 0), "unmapped Auth user received operator context");
  const { data: inactiveContext, error: inactiveContextError } = await inactiveClient.rpc("current_operator_context");
  assert(!inactiveContextError && (!inactiveContext || inactiveContext.length === 0), "inactive profile received operator context");

  const { data: members, error: memberReadError } = await librarianClient.from("members").select("id");
  assert(!memberReadError && members?.length >= 3, `librarian could not read approved member data: ${memberReadError?.message ?? `returned ${members?.length ?? 0} rows`}`);
  const { data: profilesForLibrarian, error: profileReadError } = await librarianClient.from("profiles").select("id");
  assert(!profileReadError && profilesForLibrarian.length === 0, "librarian received broad profile access");
  const { data: auditForLibrarian, error: auditReadError } = await librarianClient.from("audit_events").select("id");
  assert(!auditReadError && auditForLibrarian.length === 0, "librarian received audit access");
  const { data: profilesForAdmin, error: adminProfileReadError } = await adminAClient.from("profiles").select("id");
  assert(!adminProfileReadError && profilesForAdmin.length >= 5, "administrator could not read operator profiles");

  await expectError(
    () => librarianClient.rpc("admin_assign_role", { p_target_profile_id: adminB.profileId, p_role_key: "administrator" }),
    "librarian forged-role request unexpectedly succeeded",
  );
  await expectError(
    () => librarianClient.rpc("admin_revoke_role", { p_target_profile_id: adminA.profileId, p_role_key: "administrator" }),
    "librarian forged-profile request unexpectedly succeeded",
  );

  const { data: copies, error: copyError } = await admin.from("book_copies").select("id").limit(1);
  const { data: membersForLoan, error: loanMemberError } = await admin.from("members").select("id").limit(1);
  assert(!copyError && !loanMemberError && copies?.[0] && membersForLoan?.[0], "could not load synthetic loan fixtures");
  await expectError(
    () => librarianClient.from("loans").insert({ member_id: membersForLoan[0].id, book_copy_id: copies[0].id, due_at: "2026-12-31T00:00:00Z" }),
    "librarian direct loan mutation unexpectedly succeeded",
  );
  const { data: auditRows, error: auditRowError } = await admin.from("audit_events").select("id").limit(1);
  assert(!auditRowError && auditRows?.[0], "synthetic audit fixture is missing");
  await expectError(() => adminAClient.from("audit_events").update({ metadata: { forged: true } }).eq("id", auditRows[0].id), "administrator audit update unexpectedly succeeded");
  await expectError(() => adminAClient.from("audit_events").delete().eq("id", auditRows[0].id), "administrator audit delete unexpectedly succeeded");

  const { data: assigned, error: assignError } = await adminAClient.rpc("admin_assign_role", { p_target_profile_id: noRole.profileId, p_role_key: "librarian" });
  assert(!assignError && assigned === true, "administrator could not assign a librarian role");
  const { data: noRoleMembers, error: noRoleReadError } = await noRoleClient.from("members").select("id");
  assert(!noRoleReadError && noRoleMembers?.length >= 3, "role assignment did not take effect immediately");

  const { data: revoked, error: revokeError } = await adminAClient.rpc("admin_revoke_role", { p_target_profile_id: adminB.profileId, p_role_key: "administrator" });
  assert(!revokeError && revoked === true, "administrator could not revoke a non-final administrator role");
  const { data: revokedAdminMembers, error: revokedAdminReadError } = await adminBClient.from("members").select("id");
  assert(!revokedAdminReadError && revokedAdminMembers.length === 0, "role revocation was not immediate");
  await adminAClient.rpc("admin_assign_role", { p_target_profile_id: adminB.profileId, p_role_key: "administrator" });

  const { data: deactivated, error: deactivateError } = await adminAClient.rpc("admin_set_profile_status", { p_target_profile_id: librarian.profileId, p_status: "inactive" });
  assert(!deactivateError && deactivated === true, "administrator could not deactivate an operator");
  const { data: deactivatedMembers, error: deactivatedReadError } = await librarianClient.from("members").select("id");
  assert(!deactivatedReadError && deactivatedMembers.length === 0, "profile deactivation was not immediate");
  await adminAClient.rpc("admin_set_profile_status", { p_target_profile_id: librarian.profileId, p_status: "active" });

  await expectError(() => adminAClient.rpc("admin_revoke_role", { p_target_profile_id: adminA.profileId, p_role_key: "administrator" }), "last administrator role removal unexpectedly succeeded");
  await expectError(() => adminAClient.rpc("admin_set_profile_status", { p_target_profile_id: adminA.profileId, p_status: "inactive" }), "last administrator deactivation unexpectedly succeeded");

  const { data: auditAfter, error: auditAfterError } = await adminAClient.from("audit_events").select("action");
  assert(!auditAfterError && auditAfter.some((event) => event.action === "security.role_assigned") && auditAfter.some((event) => event.action === "security.role_revoked") && auditAfter.some((event) => event.action === "security.profile_status_changed"), "security actions were not audited");

  console.log("Auth/RLS integration tests passed: anonymous, unmapped, inactive, no-role, metadata-forgery, direct-mutation, immediate-revocation, and last-admin cases.");
} finally {
  await cleanup();
}
