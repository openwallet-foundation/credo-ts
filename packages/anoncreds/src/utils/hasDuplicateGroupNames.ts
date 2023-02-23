import type { AnonCredsProofRequest } from '../models'

import { AriesFrameworkError } from '@aries-framework/core'

function attributeNamesToArray(proofRequest: AnonCredsProofRequest) {
  // Attributes can contain either a `name` string value or an `names` string array. We reduce it to a single array
  // containing all attribute names from the requested attributes.
  return Object.values(proofRequest.requested_attributes).reduce<string[]>(
    (names, a) => [...names, ...(a.name ? [a.name] : a.names ? a.names : [])],
    []
  )
}

function predicateNamesToArray(proofRequest: AnonCredsProofRequest) {
  return Array.from(new Set(Object.values(proofRequest.requested_predicates).map((a) => a.name)))
}

// TODO: This is still not ideal. The requested groups can specify different credentials using restrictions.
export function assertNoDuplicateGroupsNamesInProofRequest(proofRequest: AnonCredsProofRequest) {
  const attributes = attributeNamesToArray(proofRequest)
  const predicates = predicateNamesToArray(proofRequest)

  const duplicates = predicates.filter((item) => attributes.indexOf(item) !== -1)
  if (duplicates.length > 0) {
    throw new AriesFrameworkError(
      `The proof request contains duplicate predicates and attributes: ${duplicates.toString()}`
    )
  }
}
