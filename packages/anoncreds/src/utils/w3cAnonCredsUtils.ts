import type { DefaultW3cCredentialTags, W3cCredentialSubject } from '@credo-ts/core'
import { CredoError, W3cCredentialRecord } from '@credo-ts/core'
import type { AnonCredsCredentialInfo, AnonCredsSchema } from '../models'
import type { AnonCredsCredentialRecord } from '../repository'
import type { AnonCredsClaimRecord } from './credential'
import { mapAttributeRawValuesToAnonCredsCredentialValues } from './credential'
import type { W3cAnonCredsCredentialMetadata } from './metadata'
import { W3cAnonCredsCredentialMetadataKey } from './metadata'

export type AnonCredsCredentialTags = {
  anonCredsLinkSecretId: string
  anonCredsCredentialRevocationId?: string
  anonCredsMethodName: string

  // the following keys can be used for every `attribute name` in credential.
  [key: `anonCredsAttr::${string}::marker`]: true | undefined
  [key: `anonCredsAttr::${string}::value`]: string | undefined

  anonCredsSchemaName: string
  anonCredsSchemaVersion: string

  anonCredsSchemaId: string
  anonCredsSchemaIssuerId: string
  anonCredsCredentialDefinitionId: string
  anonCredsRevocationRegistryId?: string
}

function anonCredsCredentialInfoFromW3cRecord(w3cCredentialRecord: W3cCredentialRecord): AnonCredsCredentialInfo {
  const firstCredential = w3cCredentialRecord.firstCredential
  if (Array.isArray(firstCredential.credentialSubject)) {
    throw new CredoError('Credential subject must be an object, not an array.')
  }

  const anonCredsTags = getAnonCredsTagsFromRecord(w3cCredentialRecord)
  if (!anonCredsTags) throw new CredoError('AnonCreds tags not found on credential record.')

  const anonCredsCredentialMetadata = w3cCredentialRecord.metadata.get<W3cAnonCredsCredentialMetadata>(
    W3cAnonCredsCredentialMetadataKey
  )
  if (!anonCredsCredentialMetadata) throw new CredoError('AnonCreds metadata not found on credential record.')

  return {
    attributes: (firstCredential.credentialSubject.claims as AnonCredsClaimRecord) ?? {},
    credentialId: w3cCredentialRecord.id,
    credentialDefinitionId: anonCredsTags.anonCredsCredentialDefinitionId,
    schemaId: anonCredsTags.anonCredsSchemaId,
    revocationRegistryId: anonCredsTags.anonCredsRevocationRegistryId ?? null,
    credentialRevocationId: anonCredsCredentialMetadata.credentialRevocationId ?? null,
    methodName: anonCredsCredentialMetadata.methodName,
    linkSecretId: anonCredsCredentialMetadata.linkSecretId,
    createdAt: w3cCredentialRecord.createdAt,
    updatedAt: w3cCredentialRecord.updatedAt ?? w3cCredentialRecord.createdAt,
  }
}

function anonCredsCredentialInfoFromAnonCredsRecord(
  anonCredsCredentialRecord: AnonCredsCredentialRecord
): AnonCredsCredentialInfo {
  const attributes: { [key: string]: string } = {}
  for (const attribute in anonCredsCredentialRecord.credential) {
    attributes[attribute] = anonCredsCredentialRecord.credential.values[attribute].raw
  }

  return {
    attributes,
    credentialDefinitionId: anonCredsCredentialRecord.credential.cred_def_id,
    credentialId: anonCredsCredentialRecord.credentialId,
    schemaId: anonCredsCredentialRecord.credential.schema_id,
    credentialRevocationId: anonCredsCredentialRecord.credentialRevocationId ?? null,
    revocationRegistryId: anonCredsCredentialRecord.credential.rev_reg_id ?? null,
    methodName: anonCredsCredentialRecord.methodName,
    linkSecretId: anonCredsCredentialRecord.linkSecretId,
    createdAt: anonCredsCredentialRecord.createdAt,
    updatedAt: anonCredsCredentialRecord.updatedAt ?? anonCredsCredentialRecord.createdAt,
  }
}

export function getAnoncredsCredentialInfoFromRecord(
  credentialRecord: W3cCredentialRecord | AnonCredsCredentialRecord
): AnonCredsCredentialInfo {
  if (credentialRecord instanceof W3cCredentialRecord) {
    return anonCredsCredentialInfoFromW3cRecord(credentialRecord)
  }
  return anonCredsCredentialInfoFromAnonCredsRecord(credentialRecord)
}
export function getAnonCredsTagsFromRecord(record: W3cCredentialRecord) {
  const anoncredsMetadata = record.metadata.get<W3cAnonCredsCredentialMetadata>(W3cAnonCredsCredentialMetadataKey)
  if (!anoncredsMetadata) return undefined

  const tags = record.getTags() as DefaultW3cCredentialTags & Partial<AnonCredsCredentialTags>
  if (
    !tags.anonCredsLinkSecretId ||
    !tags.anonCredsMethodName ||
    !tags.anonCredsSchemaId ||
    !tags.anonCredsSchemaName ||
    !tags.anonCredsSchemaVersion ||
    !tags.anonCredsSchemaIssuerId ||
    !tags.anonCredsCredentialDefinitionId
  ) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(tags).filter(([key]) => key.startsWith('anonCreds'))
  ) as AnonCredsCredentialTags
}

export function getW3cRecordAnonCredsTags(options: {
  credentialSubject: W3cCredentialSubject
  issuerId: string
  schemaId: string
  schema: Omit<AnonCredsSchema, 'attrNames'>
  credentialDefinitionId: string
  revocationRegistryId?: string
  credentialRevocationId?: string
  linkSecretId: string
  methodName: string
}) {
  const {
    credentialSubject,
    schema,
    schemaId,
    credentialDefinitionId,
    revocationRegistryId,
    credentialRevocationId,
    linkSecretId,
    methodName,
  } = options

  const anonCredsCredentialRecordTags: AnonCredsCredentialTags = {
    anonCredsLinkSecretId: linkSecretId,
    anonCredsCredentialDefinitionId: credentialDefinitionId,
    anonCredsSchemaId: schemaId,
    anonCredsSchemaName: schema.name,
    anonCredsSchemaIssuerId: schema.issuerId,
    anonCredsSchemaVersion: schema.version,
    anonCredsMethodName: methodName,
    anonCredsRevocationRegistryId: revocationRegistryId,
    anonCredsCredentialRevocationId: credentialRevocationId,
  }

  const values = mapAttributeRawValuesToAnonCredsCredentialValues(
    (credentialSubject.claims as AnonCredsClaimRecord) ?? {}
  )

  for (const [key, value] of Object.entries(values)) {
    anonCredsCredentialRecordTags[`anonCredsAttr::${key}::value`] = value.raw
    anonCredsCredentialRecordTags[`anonCredsAttr::${key}::marker`] = true
  }

  return anonCredsCredentialRecordTags
}
