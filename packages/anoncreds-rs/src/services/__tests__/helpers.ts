import type {
  AnonCredsCredential,
  AnonCredsCredentialDefinition,
  AnonCredsCredentialInfo,
  AnonCredsCredentialOffer,
} from '@aries-framework/anoncreds'
import type { JsonObject } from '@hyperledger/anoncreds-nodejs'

import {
  anoncreds,
  Credential,
  CredentialDefinition,
  CredentialOffer,
  CredentialRequest,
  CredentialRevocationConfig,
  MasterSecret,
  RevocationRegistryDefinition,
  RevocationRegistryDefinitionPrivate,
  RevocationStatusList,
  Schema,
} from '@hyperledger/anoncreds-shared'

/**
 * Creates a valid credential definition and returns its public and
 * private part, including its key correctness proof
 */
export function createCredentialDefinition(options: { attributeNames: string[]; issuerId: string }) {
  const { attributeNames, issuerId } = options

  const schema = Schema.create({
    issuerId,
    attributeNames,
    name: 'schema1',
    version: '1',
  })

  const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } = CredentialDefinition.create({
    issuerId,
    schema,
    schemaId: 'schema:uri',
    signatureType: 'CL',
    supportRevocation: true, // FIXME: Revocation should not be mandatory but current anoncreds-rs is requiring it
    tag: 'TAG',
  })

  const returnObj = {
    credentialDefinition: credentialDefinition.toJson() as unknown as AnonCredsCredentialDefinition,
    credentialDefinitionPrivate: credentialDefinitionPrivate.toJson() as unknown as JsonObject,
    keyCorrectnessProof: keyCorrectnessProof.toJson() as unknown as JsonObject,
    schema: schema.toJson() as unknown as Schema,
  }

  credentialDefinition.handle.clear()
  credentialDefinitionPrivate.handle.clear()
  keyCorrectnessProof.handle.clear()
  schema.handle.clear()

  return returnObj
}

/**
 * Creates a valid credential offer and returns itsf
 */
export function createCredentialOffer(keyCorrectnessProof: Record<string, unknown>) {
  const credentialOffer = CredentialOffer.create({
    credentialDefinitionId: 'creddef:uri',
    keyCorrectnessProof,
    schemaId: 'schema:uri',
  })
  const credentialOfferJson = credentialOffer.toJson() as unknown as AnonCredsCredentialOffer
  credentialOffer.handle.clear()
  return credentialOfferJson
}

/**
 *
 * @returns Creates a valid link secret value for anoncreds-rs
 */
export function createLinkSecret() {
  const masterSecret = MasterSecret.create()
  const ms = (masterSecret.toJson() as { value: { ms: string } }).value.ms as string
  masterSecret.handle.clear()
  return ms
}

export function createCredentialForHolder(options: {
  credentialDefinition: JsonObject
  credentialDefinitionPrivate: JsonObject
  keyCorrectnessProof: JsonObject
  schemaId: string
  credentialDefinitionId: string
  attributes: Record<string, string>
  linkSecret: string
  linkSecretId: string
  credentialId: string
  revocationRegistryDefinitionId: string
}) {
  const {
    credentialDefinition,
    credentialDefinitionPrivate,
    keyCorrectnessProof,
    schemaId,
    credentialDefinitionId,
    attributes,
    linkSecret,
    linkSecretId,
    credentialId,
    revocationRegistryDefinitionId,
  } = options

  const credentialOffer = CredentialOffer.create({
    credentialDefinitionId,
    keyCorrectnessProof,
    schemaId,
  })

  const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
    entropy: 'some-entropy',
    credentialDefinition,
    credentialOffer,
    masterSecret: { value: { ms: linkSecret } },
    masterSecretId: linkSecretId,
  })

  const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate, tailsPath } =
    createRevocationRegistryDefinition({
      credentialDefinitionId,
      credentialDefinition,
    })

  const timeCreateRevStatusList = 12
  const revocationStatusList = RevocationStatusList.create({
    issuerId: credentialDefinition.issuerId as string,
    timestamp: timeCreateRevStatusList,
    issuanceByDefault: true,
    revocationRegistryDefinition: new RevocationRegistryDefinition(revocationRegistryDefinition.handle),
    revocationRegistryDefinitionId: 'mock:uri',
  })

  const credentialObj = Credential.create({
    credentialDefinition,
    credentialDefinitionPrivate,
    credentialOffer,
    credentialRequest,
    attributeRawValues: attributes,
    revocationRegistryId: revocationRegistryDefinitionId,
    revocationStatusList,
    revocationConfiguration: new CredentialRevocationConfig({
      registryDefinition: new RevocationRegistryDefinition(revocationRegistryDefinition.handle),
      registryDefinitionPrivate: new RevocationRegistryDefinitionPrivate(revocationRegistryDefinitionPrivate.handle),
      registryIndex: 9,
      tailsPath,
    }),
  })

  const credentialInfo: AnonCredsCredentialInfo = {
    attributes,
    credentialDefinitionId,
    credentialId,
    schemaId,
  }
  const returnObj = {
    credential: credentialObj.toJson() as unknown as AnonCredsCredential,
    credentialInfo,
    revocationRegistryDefinition,
    tailsPath,
    credentialRequestMetadata,
  }

  credentialObj.handle.clear()
  credentialOffer.handle.clear()
  credentialRequest.handle.clear()
  revocationRegistryDefinitionPrivate.clear()
  revocationStatusList.handle.clear()

  return returnObj
}

export function createRevocationRegistryDefinition(options: {
  credentialDefinitionId: string
  credentialDefinition: Record<string, unknown>
}) {
  const { credentialDefinitionId, credentialDefinition } = options
  const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate } =
    anoncreds.createRevocationRegistryDefinition({
      credentialDefinitionId,
      credentialDefinition: CredentialDefinition.fromJson(credentialDefinition).handle,
      issuerId: credentialDefinition.issuerId as string,
      tag: 'some_tag',
      revocationRegistryType: 'CL_ACCUM',
      maximumCredentialNumber: 10,
    })

  const tailsPath = anoncreds.revocationRegistryDefinitionGetAttribute({
    objectHandle: revocationRegistryDefinition,
    name: 'tails_location',
  })

  return { revocationRegistryDefinition, revocationRegistryDefinitionPrivate, tailsPath }
}
