export type LibraryOnboardingContinuation = {
  displayName: string;
  libraryCode: string;
  personName: string;
  currencyCode: string;
  localeCode: string;
  timeZone: string;
  confirmation?: boolean;
  error?: string;
};

/** Carries only non-sensitive room choices needed after email confirmation. */
export function getLibraryOnboardingContinuation({
  displayName,
  libraryCode,
  personName,
  currencyCode,
  localeCode,
  timeZone,
  confirmation = false,
  error,
}: LibraryOnboardingContinuation) {
  const query = new URLSearchParams({
    name: displayName,
    code: libraryCode,
    person: personName,
    currencyCode,
    localeCode,
    timeZone,
  });
  if (confirmation) query.set("confirmation", "1");
  if (error) query.set("error", error);
  return `/create-library?${query.toString()}`;
}
