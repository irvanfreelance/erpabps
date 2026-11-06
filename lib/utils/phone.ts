import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "ID");
  if (!parsed || !parsed.isValid()) {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("62") && digits.length >= 11) return digits;
    if (digits.startsWith("0") && digits.length >= 10) return `62${digits.slice(1)}`;
    if (digits.startsWith("8") && digits.length >= 9) return `62${digits}`;
    return null;
  }
  return parsed.countryCallingCode + parsed.nationalNumber;
}
