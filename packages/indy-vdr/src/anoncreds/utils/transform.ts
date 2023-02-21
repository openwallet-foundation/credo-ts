import type { AnonCredsRevocationStatusList, AnonCredsRevocationRegistryDefinition } from '@aries-framework/anoncreds'

export function anonCredsRevocationStatusListFromIndyVdr(
  revocationRegistryDefinitionId: string,
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition,
  delta: RevocRegDelta,
  timestamp: number,
  isIssuanceByDefault: boolean
): AnonCredsRevocationStatusList {
  // 0 means unrevoked, 1 means revoked
  const defaultState = isIssuanceByDefault ? 0 : 1

  // Fill with default value
  const revocationList = new Array(revocationRegistryDefinition.value.maxCredNum).fill(defaultState)

  // Set all `issuer` indexes to 0 (not revoked)
  for (const issued of delta.issued ?? []) {
    revocationList[issued] = 0
  }

  // Set all `revoked` indexes to 1 (revoked)
  for (const revoked of delta.revoked ?? []) {
    revocationList[revoked] = 1
  }

  return {
    issuerId: revocationRegistryDefinition.issuerId,
    currentAccumulator: delta.accum,
    revRegId: revocationRegistryDefinitionId,
    revocationList,
    timestamp,
  }
}

interface RevocRegDelta {
  accum: string
  issued: number[]
  revoked: number[]
}
