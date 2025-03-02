import type { AnonCredsNonRevokedInterval, AnonCredsProofRequest, AnonCredsProofRequestRestriction } from '../models'

// Copied from the core package so we don't have to export these silly utils. We should probably move these to a separate package.
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function areObjectsEqual(a: any, b: any): boolean {
  if (typeof a === 'object' && a != null && typeof b === 'object' && b != null) {
    if (Object.keys(a).length !== Object.keys(b).length) return false
    for (const key in a) {
      if (!(key in b) || !areObjectsEqual(a[key], b[key])) {
        return false
      }
    }
    for (const key in b) {
      if (!(key in a) || !areObjectsEqual(b[key], a[key])) {
        return false
      }
    }
    return true
  }
  return a === b
}

/**
 * Checks whether two `names` arrays are equal. The order of the names doesn't matter.
 */
function areNamesEqual(namesA: string[] | undefined, namesB: string[] | undefined) {
  if (namesA === undefined) return namesB === undefined || namesB.length === 0
  if (namesB === undefined) return namesA.length === 0

  // Check if there are any duplicates
  if (new Set(namesA).size !== namesA.length || new Set(namesB).size !== namesB.length) return false

  // Check if the number of names is equal between A & B
  if (namesA.length !== namesB.length) return false

  return namesA.every((a) => namesB.includes(a))
}

/**
 * Checks whether two proof requests are semantically equal. The `name`, `version` and `nonce`, `ver` fields are ignored.
 * In addition the group names don't have to be the same between the different requests.
 */
export function areAnonCredsProofRequestsEqual(
  requestA: AnonCredsProofRequest,
  requestB: AnonCredsProofRequest
): boolean {
  // Check if the top-level non-revocation interval is equal
  if (!isNonRevokedEqual(requestA.non_revoked, requestB.non_revoked)) return false

  const attributeAList = Object.values(requestA.requested_attributes)
  const attributeBList = Object.values(requestB.requested_attributes)

  // Check if the number of attribute groups is equal in both requests
  if (attributeAList.length !== attributeBList.length) return false

  // Check if all attribute groups in A are also in B
  const attributesMatch = attributeAList.every((a) => {
    // find an attribute in B that matches this attribute
    const bIndex = attributeBList.findIndex((b) => {
      return (
        b.name === a.name &&
        areNamesEqual(a.names, b.names) &&
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

  const predicatesA = Object.values(requestA.requested_predicates)
  const predicatesB = Object.values(requestB.requested_predicates)

  if (predicatesA.length !== predicatesB.length) return false
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
function isNonRevokedEqual(
  nonRevokedA: AnonCredsNonRevokedInterval | undefined,
  nonRevokedB: AnonCredsNonRevokedInterval | undefined
) {
  // Having an empty non-revoked object is the same as not having one
  if (nonRevokedA === undefined)
    return nonRevokedB === undefined || (nonRevokedB.from === undefined && nonRevokedB.to === undefined)
  if (nonRevokedB === undefined) return nonRevokedA.from === undefined && nonRevokedA.to === undefined

  return nonRevokedA.from === nonRevokedB.from && nonRevokedA.to === nonRevokedB.to
}

/**
 * Check if two restriction lists are equal. The order of the restrictions does not matter.
 */
function areRestrictionsEqual(
  restrictionsA: AnonCredsProofRequestRestriction[] | undefined,
  restrictionsB: AnonCredsProofRequestRestriction[] | undefined
) {
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
