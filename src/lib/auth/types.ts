export const OPERATOR_ROLES = ["administrator", "librarian"] as const;

export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export type OperatorContext = {
  userId: string;
  profileId: string;
  displayName: string;
  status: "active";
  roles: OperatorRole[];
};

export type LibraryOperatorContext = OperatorContext & {
  libraryId: string;
  libraryCode: string;
  libraryName: string;
  currencyCode: string;
  localeCode: string;
  timeZone: string;
  demo?: boolean;
};

export type AccessibleLibrary = { libraryId: string; libraryCode: string; libraryName: string; currencyCode: string; localeCode: string; timeZone: string; roles: OperatorRole[] };
