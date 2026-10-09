const VALID_BARCODE = /^\d{8,14}$/;
const UPC_A_LENGTH = 12;
const EAN_13_LENGTH = 13;

/** Strips non-digits and left-pads UPC-A (12 digits) to EAN-13 so repeat scans match. */
export function normalizeBarcode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === UPC_A_LENGTH ? digits.padStart(EAN_13_LENGTH, '0') : digits;
}

/** True when the normalized code is 8 to 14 digits. */
export function isValidBarcode(code: string): boolean {
  return VALID_BARCODE.test(normalizeBarcode(code));
}
