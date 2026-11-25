import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'

/**
 * Returns true when the value is a plain record-like object that can be safely
 * traversed and rebuilt during Data Integrity boundary normalization.
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
 * inputs before canonicalization.
 *
 * Arrays are preserved and normalized element-by-element so that only object
 * fields are omitted at the service boundary before cryptosuite processing.
 *
 * A circular reference has no JSON representation, so it raises a PROOF_TRANSFORMATION_ERROR.
 */
export function omitUndefinedFields<T>(value: T): T {
  return omitUndefinedFieldsAt(value, '$', new WeakSet<object>())
}

// Only the objects on the current path are tracked, so an object that is referenced twice is not a cycle.
function omitUndefinedFieldsAt<T>(value: T, path: string, ancestors: WeakSet<object>): T {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value
  }

  if (ancestors.has(value)) {
    throw new W3cDataIntegrityProcessingError(
      W3cDataIntegrityProcessingErrorCode.ProofTransformationError,
      `Data Integrity input contains circular reference at ${path}`
    )
  }

  ancestors.add(value)

  let normalized: unknown
  if (Array.isArray(value)) {
    normalized = value.map((item, index) => omitUndefinedFieldsAt(item, `${path}[${index}]`, ancestors))
  } else {
    const normalizedEntries = Object.entries(value).flatMap(([key, nestedValue]) => {
      if (nestedValue === undefined) {
        return []
      }

      return [[key, omitUndefinedFieldsAt(nestedValue, `${path}.${key}`, ancestors)] as const]
    })
    normalized = Object.fromEntries(normalizedEntries)
  }

  ancestors.delete(value)

  return normalized as T
}
