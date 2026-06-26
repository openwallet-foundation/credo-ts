/**
 * Returns true when the value is a plain record-like object that can be safely
 * traversed and rebuilt during Data Integrity boundary normalisation.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * JavaScript permits object properties to be set to `undefined`, but `undefined`
 * is not part of the JSON data model used by Data Integrity processing.
 *
 * Recursively removes properties whose value is `undefined` from plain-object
 * inputs before canonicalisation.
 *
 * Arrays are preserved and normalised element-by-element so that only object
 * fields are omitted at the service boundary before cryptosuite processing.
 */
export function omitUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedFields(item)) as T
  }

  if (!isPlainObject(value)) {
    return value
  }

  const normalisedEntries = Object.entries(value).flatMap(([key, nestedValue]) => {
    if (nestedValue === undefined) {
      return []
    }

    return [[key, omitUndefinedFields(nestedValue)] as const]
  })

  return Object.fromEntries(normalisedEntries) as T
}
