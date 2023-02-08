import type { AnonCredsCredentialInfo } from '@aries-framework/anoncreds'

import {
  anoncreds,
  CredentialDefinition,
  CredentialDefinitionPrivate,
  CredentialOffer,
  CredentialRequest,
  KeyCorrectnessProof,
  MasterSecret,
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

  return {
    credentialDefinition: JSON.parse(credentialDefinition.toJson()),
    credentialDefinitionPrivate: JSON.parse(credentialDefinitionPrivate.toJson()),
    keyCorrectnessProof: JSON.parse(keyCorrectnessProof.toJson()),
    schema: JSON.parse(schema.toJson()),
  }
}

/**
 * Creates a valid credential offer and returns itsf
 */
export function createCredentialOffer(kcp: Record<string, unknown>) {
  const credentialOffer = CredentialOffer.create({
    credentialDefinitionId: 'creddef:uri',
    keyCorrectnessProof: KeyCorrectnessProof.load(JSON.stringify(kcp)),
    schemaId: 'schema:uri',
  })
  return JSON.parse(credentialOffer.toJson())
}

/**
 *
 * @returns Creates a valid link secret value for anoncreds-rs
 */
export function createLinkSecret() {
  return JSON.parse(MasterSecret.create().toJson()).value.ms as string
}

export function createCredentialForHolder(options: {
  credentialDefinition: Record<string, unknown>
  credentialDefinitionPrivate: Record<string, unknown>
  keyCorrectnessProof: Record<string, unknown>
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
    keyCorrectnessProof: KeyCorrectnessProof.load(JSON.stringify(keyCorrectnessProof)),
    schemaId,
  })

  const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
    credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
    credentialOffer,
    masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecret } })),
    masterSecretId: linkSecretId,
  })

  // FIXME: Revocation config should not be mandatory but current anoncreds-rs is requiring it

  const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate, tailsPath } =
    createRevocationRegistryDefinition({
      credentialDefinitionId,
      credentialDefinition,
    })

  const timeCreateRevStatusList = 12
  const revocationStatusList = anoncreds.createRevocationStatusList({
    timestamp: timeCreateRevStatusList,
    issuanceByDefault: true,
    revocationRegistryDefinition,
    revocationRegistryDefinitionId: revocationRegistryDefinitionId,
  })

  // TODO: Use Credential.create (needs to update the paramters in anoncreds-rs)
  const credentialObj = anoncreds.createCredential({
    credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)).handle,
    credentialDefinitionPrivate: CredentialDefinitionPrivate.load(JSON.stringify(credentialDefinitionPrivate)).handle,
    credentialOffer: credentialOffer.handle,
    credentialRequest: credentialRequest.handle,
    attributeRawValues: attributes,
    revocationRegistryId: revocationRegistryDefinitionId,
    revocationStatusList,
    revocationConfiguration: {
      registryIndex: 9,
      revocationRegistryDefinition,
      revocationRegistryDefinitionPrivate,
      tailsPath,
    },
  })
  const credential = anoncreds.getJson({ objectHandle: credentialObj })

  const credentialInfo: AnonCredsCredentialInfo = {
    attributes,
    credentialDefinitionId,
    credentialId,
    schemaId,
  }
  return {
    credential: JSON.parse(credential),
    credentialInfo,
    revocationRegistryDefinition,
    tailsPath,
    credentialRequestMetadata,
  }
}

export function createRevocationRegistryDefinition(options: {
  credentialDefinitionId: string
  credentialDefinition: Record<string, unknown>
}) {
  const { credentialDefinitionId, credentialDefinition } = options
  const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate } =
    anoncreds.createRevocationRegistryDefinition({
      credentialDefinitionId,
      credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)).handle,
      issuerId: 'mock:uri',
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
