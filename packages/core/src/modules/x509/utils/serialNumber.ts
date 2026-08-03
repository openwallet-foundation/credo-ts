/**
 * Normalize a hexadecimal serial number for comparison by lowercasing and stripping leading
 * zeros, so that e.g. `0A1B2C` and `0a1b2c` are treated as equal.
 */
export function normalizeSerialNumber(serialNumber: string): string {
  return serialNumber.toLowerCase().replace(/^0+/, '') || '0'
}
