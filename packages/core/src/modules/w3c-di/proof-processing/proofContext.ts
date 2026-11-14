import { areObjectsEqual, asArray } from '../../../utils'

/**
 * Checks that the document `@context` starts with the values of the proof `@context`, in the same order (verify proof
 * step 4.1 of the JCS cryptosuites).
 *
 * Entries are compared by value, because an inline context object in the document is never the same object as the one
 * in the proof once the document has been parsed or normalized.
 */
export function documentContextStartsWithProofContext(documentContext: unknown, proofContext: unknown): boolean {
  const documentValues = asArray(documentContext)
  const proofValues = asArray(proofContext)

  return (
    documentValues.length >= proofValues.length &&
    proofValues.every((value, index) => areObjectsEqual(documentValues[index], value))
  )
}
