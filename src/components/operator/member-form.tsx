"use client";

import { useState } from "react";
import { workspaceMutationAction } from "@/app/operator/[libraryCode]/actions";

type Option = { id: string; display_label?: string; display_name?: string };
type MemberRecord = { id?: string; member_identifier?: string; display_name?: string; member_kind?: string; status?: string; updated_at?: string };
type Enrollment = { academic_session_id?: string; grade_level_id?: string; section_id?: string; roll_number?: string; status?: string };

export function MemberForm({ libraryCode, member, enrollment, sessions, grades, sections, disabled = false, submitLabel = "Save member" }: {
  libraryCode: string; member?: MemberRecord; enrollment?: Enrollment; sessions: Option[]; grades: Option[]; sections: Option[]; disabled?: boolean; submitLabel?: string;
}) {
  const [kind, setKind] = useState(member?.member_kind ?? "student"); const student = kind === "student";
  return <form action={workspaceMutationAction} className="popover-form member-form">
    <input type="hidden" name="libraryCode" value={libraryCode} /><input type="hidden" name="operation" value="member_save" />
    {member?.id ? <><input type="hidden" name="id" value={member.id} /><input type="hidden" name="expectedUpdatedAt" value={member.updated_at} /></> : null}
    {member?.member_identifier ? <label>Generated member ID<input value={member.member_identifier} readOnly /></label> : <p className="field-note">A stable member ID is generated when this record is saved.</p>}
    <label>Display name<input name="displayName" defaultValue={member?.display_name} required maxLength={200} disabled={disabled} /></label>
    <label>Member kind<select name="memberKind" value={kind} onChange={(event) => setKind(event.target.value)} disabled={disabled}><option value="student">Student</option><option value="teacher">Teacher</option><option value="staff">Staff</option><option value="other">Other</option></select></label>
    <label>Member status<select name="status" defaultValue={member?.status ?? "active"} disabled={disabled}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
    <fieldset disabled={!student || disabled}><legend>Current student enrollment</legend>
      <label>Academic session<select name="academicSessionId" defaultValue={enrollment?.academic_session_id ?? ""} required={student}><option value="" disabled>Select a session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.display_label}</option>)}</select></label>
      <label>Grade / class<select name="gradeLevelId" defaultValue={enrollment?.grade_level_id ?? ""} required={student}><option value="" disabled>Select a grade</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      <label>Section<select name="sectionId" defaultValue={enrollment?.section_id ?? ""} required={student}><option value="" disabled>Select a section</option>{sections.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      <label>Roll number<input name="rollNumber" defaultValue={enrollment?.roll_number ?? ""} maxLength={40} /></label>
      <input type="hidden" name="enrollmentStatus" value={enrollment?.status ?? "active"} />
    </fieldset>
    {student && (!sessions.length || !grades.length || !sections.length) ? <p className="notice notice-error" role="alert">Configure an active session, grade, and section before creating a student.</p> : null}
    <button className="button button-primary" type="submit" disabled={disabled || (student && (!sessions.length || !grades.length || !sections.length))}>{submitLabel}</button>
  </form>;
}
