import type { ProofRequest } from '../modules/proofs/formats/indy/models/ProofRequest'

import { AriesFrameworkError } from '../error/AriesFrameworkError'

function attributeNamesToArray(proofRequest: ProofRequest) {
  // Attributes can contain either a `name` string value or an `names` string array. We reduce it to a single array
  // containing all attribute names from the requested attributes.
  return Array.from(proofRequest.requestedAttributes.values()).reduce<string[]>(
    (names, a) => [...names, ...(a.name ? [a.name] : a.names ? a.names : [])],
    []
  )
}

function predicateNamesToArray(proofRequest: ProofRequest) {
  return Array.from(new Set(Array.from(proofRequest.requestedPredicates.values()).map((a) => a.name)))
}

function assertNoDuplicates(predicates: string[], attributeNames: string[]) {
  const duplicates = predicates.filter((item) => attributeNames.indexOf(item) !== -1)
  if (duplicates.length > 0) {
    throw new AriesFrameworkError(
      `The proof request contains duplicate predicates and attributes: ${duplicates.toString()}`
    )
  }
}

// TODO: This is still not ideal. The requested groups can specify different credentials using restrictions.
export function checkProofRequestForDuplicates(proofRequest: ProofRequest) {
  const attributes = attributeNamesToArray(proofRequest)
  const predicates = predicateNamesToArray(proofRequest)
  assertNoDuplicates(predicates, attributes)
}
