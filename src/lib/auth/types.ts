export const OPERATOR_ROLES = ["administrator", "librarian"] as const;

export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export type OperatorContext = {
  userId: string;
  profileId: string;
  displayName: string;
  status: "active";
  roles: OperatorRole[];
};
