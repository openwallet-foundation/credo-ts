import type { AnonCredsProofRequest } from '../models'

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
export function hasDuplicateGroupsNamesInProofRequest(proofRequest: AnonCredsProofRequest) {
  const attributes = attributeNamesToArray(proofRequest)
  const predicates = predicateNamesToArray(proofRequest)

  const duplicates = predicates.find((item) => attributes.indexOf(item) !== -1)
  return duplicates !== undefined
}
