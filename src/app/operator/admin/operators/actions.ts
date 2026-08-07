"use server";

import { redirect } from "next/navigation";
import { assertAdministrator } from "@/lib/auth/authorization";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTION_ERROR = "The operator change could not be completed.";
const validRoles = new Set(["administrator", "librarian"]);
const validStatuses = new Set(["active", "inactive", "archived"]);

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function fail(message = ACTION_ERROR): never { redirect(`/operator/admin/operators?error=${encodeURIComponent(message)}`); }

export async function inviteOperatorAction(formData: FormData) {
  await assertAdministrator();
  const email = value(formData, "email").toLowerCase();
  const displayName = value(formData, "displayName");
  const role = value(formData, "role");
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 1 || displayName.length > 160 || !validRoles.has(role)) fail("Enter a valid email, display name, and role.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: getAuthCallbackUrl("/update-password") });
  if (error || !data.user) fail();

  const supabase = await createSupabaseServerClient();
  const { error: provisionError } = await supabase.rpc("admin_provision_operator_profile", {
    p_target_auth_user_id: data.user.id,
    p_display_name: displayName,
    p_role_key: role,
  });
  if (provisionError) {
    await admin.auth.admin.deleteUser(data.user.id);
    fail();
  }
  redirect("/operator/admin/operators?success=invited");
}

export async function assignRoleAction(formData: FormData) {
  await assertAdministrator();
  const profileId = value(formData, "profileId");
  const role = value(formData, "role");
  if (!profileId || !validRoles.has(role)) fail();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_assign_role", { p_target_profile_id: profileId, p_role_key: role });
  if (error) fail();
  redirect("/operator/admin/operators?success=role-assigned");
}

export async function revokeRoleAction(formData: FormData) {
  await assertAdministrator();
  const profileId = value(formData, "profileId");
  const role = value(formData, "role");
  if (!profileId || !validRoles.has(role)) fail();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_revoke_role", { p_target_profile_id: profileId, p_role_key: role });
  if (error) fail();
  redirect("/operator/admin/operators?success=role-revoked");
}

export async function setOperatorStatusAction(formData: FormData) {
  await assertAdministrator();
  const profileId = value(formData, "profileId");
  const status = value(formData, "status");
  if (!profileId || !validStatuses.has(status)) fail();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_profile_status", { p_target_profile_id: profileId, p_status: status });
  if (error) fail();
  redirect("/operator/admin/operators?success=status-updated");
}
