/**
 * Extracts the base email address by stripping any '+' alias tags from the local part.
 * Returns the original string safely if the email format is missing or invalid.
 *
 * @param email - The email address to extract the base email from.
 * @returns The base email address without subaddressing/aliases.
 */
export const extractBaseEmail = (email: string): string => {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return email || "";
  }
  const [localPart, ...domainParts] = email.split("@");
  const domain = domainParts.join("@");
  const baseLocalPart = localPart.split("+")[0];
  return `${baseLocalPart}@${domain}`;
};
