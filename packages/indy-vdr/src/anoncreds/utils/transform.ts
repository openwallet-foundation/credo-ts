import type { AnonCredsRevocationRegistryDefinition, AnonCredsRevocationStatusList } from '@credo-ts/anoncreds'

import { CredoError } from '@credo-ts/core'

export type RevocationRegistryDelta = {
  accum: string
  issued: number[]
  revoked: number[]
  txnTime: number
}

enum RevocationState {
  Active = 0,
  Revoked = 1,
}

export function anonCredsRevocationStatusListFromIndyVdr(
  revocationRegistryDefinitionId: string,
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition,
  delta: RevocationRegistryDelta,
  isIssuanceByDefault: boolean
): AnonCredsRevocationStatusList {
  // Check whether the highest delta index is supported in the `maxCredNum` field of the
  // revocation registry definition. This will likely also be checked on other levels as well
  // by the ledger or the indy-vdr library itself
  if (Math.max(...delta.issued, ...delta.revoked) > revocationRegistryDefinition.value.maxCredNum) {
    throw new CredoError(
      `Highest delta index '${Math.max(
        ...delta.issued,
        ...delta.revoked
      )}' is too large for the Revocation registry maxCredNum '${revocationRegistryDefinition.value.maxCredNum}' `
    )
  }

  // 0 means unrevoked, 1 means revoked
  const defaultState = isIssuanceByDefault ? RevocationState.Active : RevocationState.Revoked

  // Fill with default value
  const revocationList = new Array(revocationRegistryDefinition.value.maxCredNum).fill(defaultState)

  // Set all `issuer` indexes to 0 (not revoked)
  for (const issued of delta.issued ?? []) {
    revocationList[issued] = RevocationState.Active
  }

  // Set all `revoked` indexes to 1 (revoked)
  for (const revoked of delta.revoked ?? []) {
    revocationList[revoked] = RevocationState.Revoked
  }

  return {
    issuerId: revocationRegistryDefinition.issuerId,
    currentAccumulator: delta.accum,
    revRegDefId: revocationRegistryDefinitionId,
    revocationList,
    timestamp: delta.txnTime,
  }
}

/**
 *
 * Transforms the previous deltas and the full revocation status list into the latest delta
 *
 * ## Example
 *
 * input:
 *
 * revocationStatusList: [0, 1, 1, 1, 0, 0, 0, 1, 1, 0]
 * previousDelta:
 *   - issued: [1, 2, 5, 8, 9]
 *   - revoked: [0, 3, 4, 6, 7]
 *
 * output:
 *   - issued: [5, 9]
 *   - revoked: [3, 7]
 *
 */
export function indyVdrCreateLatestRevocationDelta(
  currentAccumulator: string,
  revocationStatusList: Array<number>,
  previousDelta?: RevocationRegistryDelta
) {
  if (previousDelta && Math.max(...previousDelta.issued, ...previousDelta.revoked) > revocationStatusList.length - 1) {
    throw new CredoError(
      `Indy Vdr delta contains an index '${Math.max(
        ...previousDelta.revoked,
        ...previousDelta.issued
      )}' that exceeds the length of the revocation status list '${revocationStatusList.length}'`
    )
  }

  const issued: Array<number> = []
  const revoked: Array<number> = []

  if (previousDelta) {
    revocationStatusList.forEach((revocationStatus, idx) => {
      // If the current status is Active and this index was previously revoked, it means the credential was just unrevoked, so add it to the issued list
      if (revocationStatus === RevocationState.Active && previousDelta.revoked.includes(idx)) {
        issued.push(idx)
      }

      // Check whether the revocationStatusList entry is not included in the previous delta revoked indices
      if (revocationStatus === RevocationState.Revoked && !previousDelta.revoked.includes(idx)) {
        revoked.push(idx)
      }
    })
  } else {
    // No delta is provided, initial state, so the entire revocation status list is converted to two list of indices
    revocationStatusList.forEach((revocationStatus, idx) => {
      if (revocationStatus === RevocationState.Active) issued.push(idx)
      if (revocationStatus === RevocationState.Revoked) revoked.push(idx)
    })
  }

  return {
    issued,
    revoked,
    accum: currentAccumulator,
    prevAccum: previousDelta?.accum,
  }
}
