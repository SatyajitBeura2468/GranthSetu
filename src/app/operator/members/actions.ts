"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { formValue, nullable } from "@/lib/operator/forms";
import { asOperatorRpcClient, rpcErrorMessage } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function fail(message: string): never { redirect(`/operator/members?error=${encodeURIComponent(message)}`); }
export async function saveMemberAction(formData: FormData) { await assertOperator(); const supabase = asOperatorRpcClient(await createSupabaseServerClient()); const id = nullable(formValue(formData, "id")); const { data, error } = await supabase.rpc("member_upsert", { p_id: id, p_member_identifier: formValue(formData, "memberIdentifier"), p_member_kind: formValue(formData, "memberKind"), p_display_name: formValue(formData, "displayName"), p_status: formValue(formData, "status") || "active", p_expected_updated_at: nullable(formValue(formData, "expectedUpdatedAt")) }); if (error || typeof data !== "string") fail(rpcErrorMessage(error)); redirect(`/operator/members/${data}?success=${encodeURIComponent(id ? "Member updated" : "Member created")}`); }
export async function saveEnrollmentAction(formData: FormData) { await assertOperator(); const supabase = asOperatorRpcClient(await createSupabaseServerClient()); const memberId = formValue(formData, "memberId"); const { error } = await supabase.rpc("member_set_enrollment", { p_member_id: memberId, p_academic_session_id: formValue(formData, "academicSessionId"), p_grade_level_id: formValue(formData, "gradeLevelId"), p_section_id: formValue(formData, "sectionId"), p_status: formValue(formData, "enrollmentStatus") || "active" }); if (error) fail(rpcErrorMessage(error)); redirect(`/operator/members/${memberId}?success=${encodeURIComponent("Enrollment saved")}`); }
