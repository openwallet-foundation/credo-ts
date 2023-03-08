import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '@aries-framework/anoncreds'
import type { CredDef, RevocReg, RevocRegDef, RevocRegDelta, Schema } from 'indy-sdk'

import { parseCredentialDefinitionId, parseSchemaId } from './identifiers'

export function anonCredsSchemaFromIndySdk(schema: Schema): AnonCredsSchema {
  const { did } = parseSchemaId(schema.id)
  return {
    issuerId: did,
    name: schema.name,
    version: schema.version,
    attrNames: schema.attrNames,
  }
}

export function indySdkSchemaFromAnonCreds(schemaId: string, schema: AnonCredsSchema, indyLedgerSeqNo: number): Schema {
  return {
    id: schemaId,
    attrNames: schema.attrNames,
    name: schema.name,
    version: schema.version,
    ver: '1.0',
    seqNo: indyLedgerSeqNo,
  }
}

export function anonCredsCredentialDefinitionFromIndySdk(credentialDefinition: CredDef): AnonCredsCredentialDefinition {
  const { did } = parseCredentialDefinitionId(credentialDefinition.id)

  return {
    issuerId: did,
    schemaId: credentialDefinition.schemaId,
    tag: credentialDefinition.tag,
    type: 'CL',
    value: credentialDefinition.value,
  }
}

export function indySdkCredentialDefinitionFromAnonCreds(
  credentialDefinitionId: string,
  credentialDefinition: AnonCredsCredentialDefinition
): CredDef {
  return {
    id: credentialDefinitionId,
    schemaId: credentialDefinition.schemaId,
    tag: credentialDefinition.tag,
    type: credentialDefinition.type,
    value: credentialDefinition.value,
    ver: '1.0',
  }
}

export function indySdkRevocationRegistryDefinitionFromAnonCreds(
  revocationRegistryDefinitionId: string,
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
): RevocRegDef {
  return {
    id: revocationRegistryDefinitionId,
    credDefId: revocationRegistryDefinition.credDefId,
    revocDefType: revocationRegistryDefinition.revocDefType,
    tag: revocationRegistryDefinition.tag,
    value: {
      issuanceType: 'ISSUANCE_BY_DEFAULT', // NOTE: we always use ISSUANCE_BY_DEFAULT when passing to the indy-sdk. It doesn't matter, as we have the revocation List with the full state
      maxCredNum: revocationRegistryDefinition.value.maxCredNum,
      publicKeys: revocationRegistryDefinition.value.publicKeys,
      tailsHash: revocationRegistryDefinition.value.tailsHash,
      tailsLocation: revocationRegistryDefinition.value.tailsLocation,
    },
    ver: '1.0',
  }
}

export function anonCredsRevocationStatusListFromIndySdk(
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
  for (const issued of delta.value.issued ?? []) {
    revocationList[issued] = 0
  }

  // Set all `revoked` indexes to 1 (revoked)
  for (const revoked of delta.value.revoked ?? []) {
    revocationList[revoked] = 1
  }

  return {
    issuerId: revocationRegistryDefinition.issuerId,
    currentAccumulator: delta.value.accum,
    revRegId: revocationRegistryDefinitionId,
    revocationList,
    timestamp,
  }
}

export function indySdkRevocationRegistryFromAnonCreds(revocationStatusList: AnonCredsRevocationStatusList): RevocReg {
  return {
    ver: '1.0',
    value: {
      accum: revocationStatusList.currentAccumulator,
    },
  }
}

export function indySdkRevocationDeltaFromAnonCreds(
  revocationStatusList: AnonCredsRevocationStatusList
): RevocRegDelta {
  // Get all indices from the revocationStatusList that are revoked (so have value '1')
  const revokedIndices = revocationStatusList.revocationList.reduce<number[]>(
    (revoked, current, index) => (current === 1 ? [...revoked, index] : revoked),
    []
  )

  return {
    value: {
      accum: revocationStatusList.currentAccumulator,
      issued: [],
      revoked: revokedIndices,
      // NOTE: I don't think this is used?
      prevAccum: '',
    },
    ver: '1.0',
  }
}
