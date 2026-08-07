import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { type OperatorContext, type OperatorRole, OPERATOR_ROLES } from "@/lib/auth/types";

export class AuthorizationError extends Error {
  constructor() {
    super("You are not authorized to perform this action.");
    this.name = "AuthorizationError";
  }
}

type OperatorContextRow = {
  user_id: string;
  profile_id: string;
  display_name: string;
  status: "active";
  roles: string[];
};

function isOperatorRole(value: string): value is OperatorRole {
  return (OPERATOR_ROLES as readonly string[]).includes(value);
}

export async function getOperatorContextFromClient(
  supabase: SupabaseClient<Database>,
): Promise<OperatorContext | null> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data, error } = await supabase.rpc("current_operator_context");
  if (error || !data?.[0]) return null;

  const row = data[0] as OperatorContextRow;
  const roles = (row.roles ?? []).filter(isOperatorRole);
  if (row.user_id !== claims.sub || row.status !== "active" || roles.length === 0) return null;

  return {
    userId: row.user_id,
    profileId: row.profile_id,
    displayName: row.display_name,
    status: "active",
    roles,
  };
}

export async function getOperatorContext() {
  const supabase = await createSupabaseServerClient();
  return getOperatorContextFromClient(supabase);
}

export function hasRole(context: OperatorContext, role: OperatorRole) {
  return context.roles.includes(role);
}

export async function requireOperator() {
  const context = await getOperatorContext();
  if (!context) redirect("/login?next=%2Foperator");
  return context;
}

export async function requireAdministrator() {
  const context = await requireOperator();
  if (!hasRole(context, "administrator")) redirect("/operator?error=forbidden");
  return context;
}

export async function assertOperator() {
  const context = await getOperatorContext();
  if (!context) throw new AuthorizationError();
  return context;
}

export async function assertAdministrator() {
  const context = await assertOperator();
  if (!hasRole(context, "administrator")) throw new AuthorizationError();
  return context;
}
