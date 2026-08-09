import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { type AccessibleLibrary, type LibraryOperatorContext, type OperatorContext, type OperatorRole, OPERATOR_ROLES } from "@/lib/auth/types";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { normalizeLibraryCode } from "@/lib/library/code";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

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

export async function getLibraryOperatorContext(rawCode: string): Promise<LibraryOperatorContext | null> {
  const libraryCode = normalizeLibraryCode(rawCode);
  if (process.env.NODE_ENV === "development" && !getOptionalPublicSupabaseEnv() && libraryCode === "OAVMUSI") {
    return { userId: "demo-user", profileId: "demo-profile", displayName: "Demo Librarian", status: "active", roles: ["administrator", "librarian"], libraryId: "10000000-0000-0000-0000-000000000001", libraryCode, libraryName: "OAV Musiguda Library", demo: true };
  }
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return null;
  const { data, error } = await asOperatorRpcClient(supabase).rpc("operator_context_for_library", { p_library_code: libraryCode });
  const row = (Array.isArray(data) ? data[0] : null) as { user_id?: string; profile_id?: string; display_name?: string; library_id?: string; library_code?: string; library_name?: string; roles?: string[] } | null;
  if (error || !row?.profile_id || row.user_id !== claimsData.claims.sub) return null;
  const roles = (row.roles ?? []).filter(isOperatorRole);
  if (!roles.length) return null;
  return { userId: row.user_id!, profileId: row.profile_id, displayName: row.display_name ?? "Operator", status: "active", roles, libraryId: row.library_id!, libraryCode: row.library_code ?? libraryCode, libraryName: row.library_name ?? "Library Room" };
}

export async function requireLibraryOperator(code: string) {
  const context = await getLibraryOperatorContext(code);
  if (!context) redirect(`/l/${normalizeLibraryCode(code)}/login`);
  return context;
}

export async function requireLibraryAdministrator(code: string) {
  const context = await requireLibraryOperator(code);
  if (!hasRole(context, "administrator")) redirect(`/operator/${context.libraryCode}?error=forbidden`);
  return context;
}

export async function getAccessibleLibraries(): Promise<AccessibleLibrary[]> {
  if (process.env.NODE_ENV === "development" && !getOptionalPublicSupabaseEnv()) {
    return [{ libraryId: "10000000-0000-0000-0000-000000000001", libraryCode: "OAVMUSI", libraryName: "OAV Musiguda Library", roles: ["administrator", "librarian"] }];
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await asOperatorRpcClient(supabase).rpc("operator_accessible_libraries");
  if (error || !Array.isArray(data)) return [];
  return (data as Array<{ library_id?: string; library_code?: string; library_name?: string; roles?: string[] }>).flatMap((row) => {
    const roles = (row.roles ?? []).filter(isOperatorRole);
    return row.library_id && row.library_code && row.library_name && roles.length
      ? [{ libraryId: row.library_id, libraryCode: row.library_code, libraryName: row.library_name, roles }]
      : [];
  });
}
