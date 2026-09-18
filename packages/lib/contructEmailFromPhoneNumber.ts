/**
 * Constructs an SMS gateway email from a phone number by stripping non-digit characters.
 * Handles null/undefined inputs safely.
 *
 * @param phoneNumber - The phone number to format into an SMS gateway email.
 * @returns The formatted SMS email address.
 */
export const contructEmailFromPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return "@sms.cal.com";
  }
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
  return `${cleanedPhoneNumber}@sms.cal.com`;
};
