/**
 * ISO 8601 DateTime Validation
 *
 * Inlined from iso-8601-regex (https://github.com/lightningspirit/iso-8601-regex-ts)
 * Licensed under MIT by lightningspirit
 *
 * Enforces strict calendar correctness including leap-year rules and valid day ranges.
 */

/**
 * Strict ISO 8601 datetime regex with full calendar validation.
 *
 * Enforces:
 * - Year: 0000–9999
 * - Month: 01–12
 * - Day: per month (01–31, 30-day months restricted, Feb 29 allowed only on leap years)
 * - Hour: 00–23
 * - Minute: 00–59
 * - Second: 00–59
 * - Milliseconds: optional, 1–3 digits
 * - Timezone: "Z" (UTC) or ±HH:MM (offset -12:00…+14:00)
 *
 * Leap-year logic (Gregorian calendar):
 * - Divisible by 4 → leap year
 * - Divisible by 100 → not a leap year
 * - Divisible by 400 → leap year again
 *
 * Format: YYYY-MM-DDTHH:mm:ss(.SSS)?(Z|±HH:MM)
 *
 * Valid examples:
 * - "2025-11-02T10:20:30Z"           // UTC
 * - "2025-11-02T10:20:30.123Z"       // With milliseconds
 * - "2025-11-02T10:20:30+01:00"      // With positive offset
 * - "2024-02-29T12:00:00Z"           // Leap year (Feb 29 allowed)
 *
 * Invalid examples:
 * - "2025-11-02T10:20:30"            // Missing timezone
 * - "2025-04-31T12:00:00Z"           // Invalid day for April
 * - "1900-02-29T00:00:00Z"           // 1900 not a leap year
 * - "2025-11-02T24:00:00Z"           // Invalid hour
 */
export const ISO8601_DATETIME_REGEX = new RegExp(
  '^' +
    '(?<year>\\d{4})-' +
    '(?<month>(?:0[1-9]|1[0-2]))-' +
    '(?<day>' +
    '(?:' +
    '(?<=\\d{4}-(?:01|03|05|07|08|10|12)-)(?:0[1-9]|[12]\\d|3[01])|' + // 31-day months
    '(?<=\\d{4}-(?:04|06|09|11)-)(?:0[1-9]|[12]\\d|30)|' + // 30-day months
    '(?<=\\d{4}-02-)(?:0[1-9]|1\\d|2[0-8])|' + // Feb 01-28
    '(?<=(' +
    '(?:\\d{2}(?:0[48]|[2468][048]|[13579][26]))' + // yy % 4 == 0 (leap year non-century)
    '|(?:(?:[02468][048]|[13579][26])00)' + // centuries % 400 == 0 (leap year century)
    ')-02-)29' + // Feb 29 only if preceding matches leap year
    ')' +
    ')' +
    'T' +
    '(?<hour>(?:[01]\\d|2[0-3])):' +
    '(?<minute>[0-5]\\d):' +
    '(?<second>[0-5]\\d)' +
    '(?:\\.(?<millisecond>\\d{1,3}))?' + // optional .sss
    '(?<timezone>' +
    'Z|' + // UTC
    '(?:' +
    '\\+(?:(?:0\\d|1[0-3]):[0-5]\\d|14:00)|' + // +00:00…+13:59 or +14:00
    '-(?:(?:0\\d|1[01]):[0-5]\\d|12:00)' + // -00:00…-11:59 or -12:00
    ')' +
    ')' +
    '$'
)

/**
 * Validate XSD dateTimeStamp format per W3C XMLSCHEMA11-2.
 *
 * Requires timezone component (Z or ±HH:MM offset) with full calendar validation.
 * Falls back to Date.parse() for semantic correctness.
 *
 * Spec reference: VC DI EdDSA v1.0 §3.3.5 step 3
 * https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
 */
export function isXsdDateTimeStamp(value: string): boolean {
  if (!ISO8601_DATETIME_REGEX.test(value)) {
    return false
  }

  return !Number.isNaN(Date.parse(value))
}
