/**
 * Keep a selected identity only while it remains visible in the authoritative
 * candidate context. This is shared by the component and its lifecycle test so
 * hidden form values cannot outlive the candidates rendered beside them.
 */
export function reconcileIssueSelection(selectedMemberId, selectedCopyId, members, copies, ready) {
  const visibleMemberId = selectedMemberId && members.some((member) => member.member_id === selectedMemberId) ? selectedMemberId : null;
  const visibleCopyId = selectedCopyId && copies.some((copy) => copy.copy_id === selectedCopyId) ? selectedCopyId : null;

  return {
    selectedMemberId: visibleMemberId,
    selectedCopyId: visibleCopyId,
    canIssue: Boolean(ready && visibleMemberId && visibleCopyId),
  };
}
