/**
 * Formats a Brazilian phone number as the user types.
 * Supports both 8-digit (landline) and 9-digit (mobile) formats:
 *   (11) 9999-9999  or  (11) 99999-9999
 */
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  const len = digits.length;

  if (len === 0) return '';
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Strip mask characters, returning only digits */
export function stripPhoneMask(value: string): string {
  return value.replace(/\D/g, '');
}
