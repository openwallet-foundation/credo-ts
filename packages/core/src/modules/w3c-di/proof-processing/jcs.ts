import { canonicalizeEx } from 'json-canonicalize'

import { isObject } from '../../../utils/object'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import { omitUndefinedFields } from './normalization'

/**
 * Applies the JSON Canonicalization Scheme (RFC 8785) after dropping undefined object fields.
 *
 * Values that have no JSON representation (undefined in arrays, functions, symbols, bigints,
 * non-finite numbers and circular references) raise a PROOF_TRANSFORMATION_ERROR instead of being silently coerced.
 */
export function canonicalizeJcsStrict(value: unknown): string {
  const normalized = omitUndefinedFields(value)
  assertJcsInput(normalized)
  return canonicalizeEx(normalized, {
    allowCircular: false,
    filterUndefined: true,
    undefinedInArrayToNull: false,
  })
}

// Only the objects on the current path are tracked, so an object that is referenced twice is not a cycle.
function assertJcsInput(value: unknown, path = '$', ancestors = new WeakSet<object>()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    const err = `JCS canonicalization input contains unsupported value at ${path}`
    throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    const err = `JCS canonicalization input contains non-finite number at ${path}`
    throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
  }

  if (!Array.isArray(value) && !isObject(value)) {
    return
  }

  if (ancestors.has(value)) {
    const err = `JCS canonicalization input contains circular reference at ${path}`
    throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
  }

  ancestors.add(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertJcsInput(value[i], `${path}[${i}]`, ancestors)
    }
  } else {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertJcsInput(nestedValue, `${path}.${key}`, ancestors)
    }
  }

  ancestors.delete(value)
}
