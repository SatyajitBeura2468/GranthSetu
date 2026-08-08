"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { formValue, nullable } from "@/lib/operator/forms";
import { asOperatorRpcClient, rpcErrorMessage } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function fail(message: string): never { redirect(`/operator/members?error=${encodeURIComponent(message)}`); }
export async function saveMemberAction(formData: FormData) {
  await assertOperator();
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const id = nullable(formValue(formData, "id"));
  const kind = formValue(formData, "memberKind");
  const args = { p_display_name: formValue(formData, "displayName"), p_member_kind: kind, p_status: formValue(formData, "status") || "active", p_academic_session_id: nullable(formValue(formData, "academicSessionId")), p_grade_level_id: nullable(formValue(formData, "gradeLevelId")), p_section_id: nullable(formValue(formData, "sectionId")), p_roll_number: nullable(formValue(formData, "rollNumber")), p_enrollment_status: formValue(formData, "enrollmentStatus") || "active" };
  const result = id
    ? await supabase.rpc("member_update_profile", { p_id: id, p_member_kind: kind, p_display_name: args.p_display_name, p_status: args.p_status, p_expected_updated_at: nullable(formValue(formData, "expectedUpdatedAt")) })
    : await supabase.rpc("member_create_with_enrollment", args);
  if (result.error || typeof result.data !== "string") fail(rpcErrorMessage(result.error));
  redirect(`/operator/members/${result.data}?success=${encodeURIComponent(id ? "Member updated" : "Member created")}`);
}

export async function saveEnrollmentAction(formData: FormData) {
  await assertOperator();
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const memberId = formValue(formData, "memberId");
  const { error } = await supabase.rpc("member_set_enrollment_v71", { p_member_id: memberId, p_academic_session_id: formValue(formData, "academicSessionId"), p_grade_level_id: formValue(formData, "gradeLevelId"), p_section_id: formValue(formData, "sectionId"), p_roll_number: nullable(formValue(formData, "rollNumber")), p_status: formValue(formData, "enrollmentStatus") || "active" });
  if (error) fail(rpcErrorMessage(error));
  redirect(`/operator/members/${memberId}?success=${encodeURIComponent("Enrollment saved")}`);
}
