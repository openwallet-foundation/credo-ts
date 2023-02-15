import type { V1PresentationPreviewAttributeOptions, V1PresentationPreviewPredicateOptions } from '../../protocol'
import type { default as Indy } from 'indy-sdk'

import { AriesFrameworkError } from '../../../../error'
import { areObjectsEqual } from '../../../../utils'
import { uuid } from '../../../../utils/uuid'

import { ProofAttributeInfo, ProofPredicateInfo, ProofRequest } from './models'

export function createRequestFromPreview({
  name,
  version,
  nonce,
  attributes,
  predicates,
}: {
  name: string
  version: string
  nonce: string
  attributes: V1PresentationPreviewAttributeOptions[]
  predicates: V1PresentationPreviewPredicateOptions[]
}): ProofRequest {
  const proofRequest = new ProofRequest({
    name,
    version,
    nonce,
  })

  /**
   * Create mapping of attributes by referent. This required the
   * attributes to come from the same credential.
   * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#referent
   *
   * {
   *  "referent1": [Attribute1, Attribute2],
   *  "referent2": [Attribute3]
   * }
   */
  const attributesByReferent: Record<string, V1PresentationPreviewAttributeOptions[]> = {}
  for (const proposedAttributes of attributes ?? []) {
    if (!proposedAttributes.referent) proposedAttributes.referent = uuid()

    const referentAttributes = attributesByReferent[proposedAttributes.referent]

    // Referent key already exist, add to list
    if (referentAttributes) {
      referentAttributes.push(proposedAttributes)
    }

    // Referent key does not exist yet, create new entry
    else {
      attributesByReferent[proposedAttributes.referent] = [proposedAttributes]
    }
  }

  // Transform attributes by referent to requested attributes
  for (const [referent, proposedAttributes] of Object.entries(attributesByReferent)) {
    // Either attributeName or attributeNames will be undefined
    const attributeName = proposedAttributes.length === 1 ? proposedAttributes[0].name : undefined
    const attributeNames = proposedAttributes.length > 1 ? proposedAttributes.map((a) => a.name) : undefined

    const requestedAttribute = new ProofAttributeInfo({
      name: attributeName,
      names: attributeNames,
      restrictions: [
        {
          credentialDefinitionId: proposedAttributes[0].credentialDefinitionId,
        },
      ],
    })

    proofRequest.requestedAttributes.set(referent, requestedAttribute)
  }

  // Transform proposed predicates to requested predicates
  for (const proposedPredicate of predicates ?? []) {
    const requestedPredicate = new ProofPredicateInfo({
      name: proposedPredicate.name,
      predicateType: proposedPredicate.predicate,
      predicateValue: proposedPredicate.threshold,
      restrictions: [
        {
          credentialDefinitionId: proposedPredicate.credentialDefinitionId,
        },
      ],
    })

    proofRequest.requestedPredicates.set(uuid(), requestedPredicate)
  }

  return proofRequest
}

/**
 * Checks whether two `names` arrays are equal. The order of the names doesn't matter.
 */
function areNamesEqual({
  nameA,
  namesA,
  nameB,
  namesB,
}: {
  namesA?: string[]
  nameA?: string
  namesB?: string[]
  nameB?: string
}) {
  const namesACombined = nameA ? [nameA] : namesA
  const namesBCombined = nameB ? [nameB] : namesB

  // Filter out case where both are not set (invalid)
  if (!namesACombined || !namesBCombined) return false

  // Check if there are any duplicates
  if (new Set(namesACombined).size !== namesACombined.length || new Set(namesBCombined).size !== namesBCombined.length)
    return false

  // Check if the number of names is equal between A & B
  if (namesACombined.length !== namesBCombined.length) return false

  return namesACombined.every((a) => namesBCombined.includes(a))
}

/**
 * Checks whether two proof requests are semantically equal. The `name`, `version` and `nonce`, `ver` fields are ignored.
 * In addition the group names don't have to be the same between the different requests.
 */
export function areIndyProofRequestsEqual(requestA: Indy.IndyProofRequest, requestB: Indy.IndyProofRequest): boolean {
  // Check if the top-level non-revocation interval is equal
  if (!isNonRevokedEqual(requestA.non_revoked, requestB.non_revoked)) return false

  const attributeAList = Object.values(requestA.requested_attributes)
  const attributeBList = Object.values(requestB.requested_attributes)

  // Check if the number of attribute groups is equal in both requests
  if (attributeAList.length !== attributeBList.length) return false

  const predicatesA = Object.values(requestA.requested_predicates)
  const predicatesB = Object.values(requestB.requested_predicates)

  if (predicatesA.length !== predicatesB.length) return false

  // Check if all attribute groups in A are also in B
  const attributesMatch = attributeAList.every((a) => {
    // find an attribute in B that matches this attribute
    const bIndex = attributeBList.findIndex((b) => {
      return (
        // Check if name and names are equal
        areNamesEqual({
          nameB: b.name,
          namesB: b.names,
          nameA: a.name,
          namesA: a.names,
        }) &&
        isNonRevokedEqual(a.non_revoked, b.non_revoked) &&
        areRestrictionsEqual(a.restrictions, b.restrictions)
      )
    })

    // Match found
    if (bIndex !== -1) {
      attributeBList.splice(bIndex, 1)
      return true
    }

    // Match not found
    return false
  })

  if (!attributesMatch) return false

  const predicatesMatch = predicatesA.every((a) => {
    // find a predicate in B that matches this predicate
    const bIndex = predicatesB.findIndex((b) => {
      return (
        a.name === b.name &&
        a.p_type === b.p_type &&
        a.p_value === b.p_value &&
        isNonRevokedEqual(a.non_revoked, b.non_revoked) &&
        areRestrictionsEqual(a.restrictions, b.restrictions)
      )
    })

    if (bIndex !== -1) {
      predicatesB.splice(bIndex, 1)
      return true
    }

    return false
  })

  if (!predicatesMatch) return false

  return true
}

/**
 * Checks whether two non-revocation intervals are semantically equal. They are considered equal if:
 * - Both are undefined
 * - Both are empty objects
 * - One if undefined and the other is an empty object
 * - Both have the same from and to values
 */
function isNonRevokedEqual(nonRevokedA?: Indy.NonRevokedInterval, nonRevokedB?: Indy.NonRevokedInterval) {
  // Having an empty non-revoked object is the same as not having one
  if (nonRevokedA === undefined)
    return nonRevokedB === undefined || (nonRevokedB.from === undefined && nonRevokedB.to === undefined)
  if (nonRevokedB === undefined) return nonRevokedA.from === undefined && nonRevokedA.to === undefined

  return nonRevokedA.from === nonRevokedB.from && nonRevokedA.to === nonRevokedB.to
}

/**
 * Check if two restriction lists are equal. The order of the restrictions does not matter.
 */
function areRestrictionsEqual(restrictionsA?: Indy.WalletQuery[], restrictionsB?: Indy.WalletQuery[]) {
  // Having an undefined restrictions property or an empty array is the same
  if (restrictionsA === undefined) return restrictionsB === undefined || restrictionsB.length === 0
  if (restrictionsB === undefined) return restrictionsA.length === 0

  // Clone array to not modify input object
  const bList = [...restrictionsB]

  // Check if all restrictions in A are also in B
  return restrictionsA.every((a) => {
    const bIndex = restrictionsB.findIndex((b) => areObjectsEqual(a, b))

    // Match found
    if (bIndex !== -1) {
      bList.splice(bIndex, 1)
      return true
    }

    // Match not found
    return false
  })
}

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
export function assertNoDuplicateGroupsNamesInProofRequest(proofRequest: ProofRequest) {
  const attributes = attributeNamesToArray(proofRequest)
  const predicates = predicateNamesToArray(proofRequest)
  assertNoDuplicates(predicates, attributes)
}
