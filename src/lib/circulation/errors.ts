const messages: Record<string, string> = {
  GS_NOT_OPERATOR: "Your operator access is no longer active.",
  GS_MEMBER_NOT_FOUND: "Member not found.",
  GS_MEMBER_INACTIVE: "This member is not active.",
  GS_STUDENT_ENROLMENT_REQUIRED: "This student has no active enrolment for the current academic session.",
  GS_POLICY_NOT_CONFIGURED: "Circulation policy is not configured for this environment.",
  GS_CHECKOUT_LIMIT_REACHED: "This member has reached the configured checkout limit.",
  GS_COPY_NOT_FOUND: "Physical copy not found.",
  GS_COPY_NOT_CIRCULATABLE: "This copy is not available for circulation.",
  GS_BOOK_ARCHIVED: "The parent book is archived.",
  GS_COPY_ALREADY_ON_LOAN: "This copy is already on loan.",
  GS_LOAN_NOT_FOUND: "Loan not found.",
  GS_LOAN_ALREADY_RETURNED: "This loan has already been returned.",
  GS_LOAN_NOT_ACTIVE: "Only active loans can be renewed.",
  GS_LOAN_OVERDUE: "Overdue loans cannot be renewed under the current provisional policy.",
  GS_RENEWAL_LIMIT_REACHED: "This loan has reached the configured renewal limit.",
  GS_FINES_DISABLED: "Fines are disabled in this environment.",
  GS_LOAN_NOT_RETURNED: "Assess an overdue fine only after the loan is returned.",
  GS_FINE_POLICY_NOT_CONFIGURED: "Fine policy is not configured for this environment.",
  GS_NO_FINE_DUE: "No fine is due for this loan.",
  GS_FINE_NOT_FOUND: "Fine not found.",
  GS_FINE_ALREADY_ASSESSED: "An overdue fine already exists for this loan.",
  GS_FINE_AMOUNT_INVALID: "Enter a positive INR amount with no more than two decimal places.",
  GS_FINE_OUTSTANDING_EXCEEDED: "That amount exceeds the fine outstanding.",
  GS_ADMIN_REQUIRED: "Only administrators may waive fines.",
  GS_REQUEST_ID_REUSED: "This request token was already used for another operation.",
};

export function circulationErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const code = Object.keys(messages).find((key) => raw.includes(key));
  return code ? messages[code] : "The circulation operation could not be completed.";
}
