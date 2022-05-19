import type { ProofRequest } from '../modules/proofs/models/ProofRequest'

import { assertNoDuplicatesInArray } from './assertNoDuplicates'

export function attributeNamesToArray(proofRequest: ProofRequest) {
  // Attributes can contain either a `name` string value or an `names` string array. We reduce it to a single array
  // containing all attribute names from the requested attributes.
  return Array.from(proofRequest.requestedAttributes.values()).reduce<string[]>(
    (names, a) => [...names, ...(a.name ? [a.name] : a.names ? a.names : [])],
    []
  )
}

export function predicateNamesToArray(proofRequest: ProofRequest) {
  return Array.from(proofRequest.requestedPredicates.values()).map((a) => a.name)
}

export function checkProofRequestForDuplicates(proofRequest: ProofRequest) {
  const attributes = attributeNamesToArray(proofRequest)
  const predicates = predicateNamesToArray(proofRequest)
  assertNoDuplicatesInArray(attributes.concat(predicates))
}
