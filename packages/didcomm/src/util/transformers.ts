import { DateTime } from 'luxon'

/*
 * Function that parses date from multiple formats
 * including SQL formats.
 */

export function DateParser(value: string): Date {
  const parsedDate = new Date(value)
  if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
    return parsedDate
  }
  const luxonDate = DateTime.fromSQL(value)
  if (luxonDate.isValid) {
    return new Date(luxonDate.toString())
  }
  return new Date()
}

// DateParser turns an unset value into the current time, or 1970 for null
export function OptionalDateParser(value?: string | null): Date | undefined {
  return value == null ? undefined : DateParser(value)
}
