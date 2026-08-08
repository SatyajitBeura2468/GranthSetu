import "server-only";

export type OperatorRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

export function asOperatorRpcClient(client: unknown) {
  return client as OperatorRpcClient;
}

export function rpcErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const messages: Record<string, string> = {
    GS_REFERENCE_NAME_INVALID: "Enter a non-empty name up to 160 characters.",
    GS_REFERENCE_DUPLICATE: "That reference record already exists.",
    GS_LOCATION_INVALID: "Enter a location code and display name.",
    GS_BOOK_TITLE_REQUIRED: "Book title and at least one author are required.",
    GS_AUTHOR_REQUIRED: "Add at least one author before saving the book.",
    GS_BOOK_DUPLICATE: "A matching book record already exists.",
    GS_BOOK_NOT_FOUND: "Book not found.",
    GS_PUBLISHER_NOT_FOUND: "Publisher not found.",
    GS_ACCESSION_REQUIRED: "Accession number is required.",
    GS_ACCESSION_DUPLICATE: "Accession number already exists.",
    GS_COPY_STATE_INVALID: "Choose a valid copy condition and lifecycle state.",
    GS_COPY_ON_LOAN: "This copy is currently on loan.",
    GS_MEMBER_INPUT_INVALID: "Enter a valid member identifier, name, kind, and status.",
    GS_MEMBER_IDENTIFIER_DUPLICATE: "Member identifier already exists.",
    GS_MEMBER_NOT_FOUND: "Member not found.",
    GS_STUDENT_MEMBER_REQUIRED: "Enrollment can only be assigned to a student member.",
    GS_ENROLLMENT_INPUT_INVALID: "Choose a valid academic session, grade, section, and status.",
    GS_ACADEMIC_SESSION_INVALID: "Enter a valid academic session and date range.",
    GS_ACADEMIC_INPUT_INVALID: "Enter valid academic structure values.",
    GS_SETTING_INVALID: "Enter a valid policy setting value.",
    GS_STALE_UPDATE: "This record changed since you opened it. Reload before saving.",
    GS_COVER_PATH_INVALID: "The cover file path was rejected.",
    GS_STATUS_INVALID: "Choose a valid lifecycle status.",
    GS_NOT_OPERATOR: "Your operator access is no longer active.",
  };
  const code = Object.keys(messages).find((key) => raw.includes(key));
  return code ? messages[code] : "The requested operation could not be completed.";
}
