import type {
  AnonCredsIssuerService,
  CreateCredentialDefinitionOptions,
  CreateCredentialOfferOptions,
  CreateCredentialOptions,
  CreateCredentialReturn,
  CreateSchemaOptions,
  AnonCredsCredentialOffer,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  CreateCredentialDefinitionReturn,
  AnonCredsCredential,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { CredentialDefinitionPrivate, JsonObject, KeyCorrectnessProof } from '@hyperledger/anoncreds-shared'

import {
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRepository,
} from '@aries-framework/anoncreds'
import { injectable, AriesFrameworkError } from '@aries-framework/core'
import { Credential, CredentialDefinition, CredentialOffer, Schema } from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
export class AnonCredsRsIssuerService implements AnonCredsIssuerService {
  public async createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
    const { issuerId, name, version, attrNames: attributeNames } = options

    let schema: Schema | undefined
    try {
      const schema = Schema.create({
        issuerId,
        name,
        version,
        attributeNames,
      })

      return schema.toJson() as unknown as AnonCredsSchema
    } finally {
      schema?.handle.clear()
    }
  }

  public async createCredentialDefinition(
    agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions
  ): Promise<CreateCredentialDefinitionReturn> {
    const { tag, supportRevocation, schema, issuerId, schemaId } = options

    let createReturnObj:
      | {
          credentialDefinition: CredentialDefinition
          credentialDefinitionPrivate: CredentialDefinitionPrivate
          keyCorrectnessProof: KeyCorrectnessProof
        }
      | undefined
    try {
      createReturnObj = CredentialDefinition.create({
        schema: schema as unknown as JsonObject,
        issuerId,
        schemaId,
        tag,
        supportRevocation,
        signatureType: 'CL',
      })

      return {
        credentialDefinition: createReturnObj.credentialDefinition.toJson() as unknown as AnonCredsCredentialDefinition,
        credentialDefinitionPrivate: createReturnObj.credentialDefinitionPrivate.toJson(),
        keyCorrectnessProof: createReturnObj.keyCorrectnessProof.toJson(),
      }
    } finally {
      createReturnObj?.credentialDefinition.handle.clear()
      createReturnObj?.credentialDefinitionPrivate.handle.clear()
      createReturnObj?.keyCorrectnessProof.handle.clear()
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    const { credentialDefinitionId } = options

    let credentialOffer: CredentialOffer | undefined
    try {
      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      const keyCorrectnessProofRecord = await agentContext.dependencyManager
        .resolve(AnonCredsKeyCorrectnessProofRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      if (!credentialDefinitionRecord) {
        throw new AnonCredsRsError(`Credential Definition ${credentialDefinitionId} not found`)
      }

      credentialOffer = CredentialOffer.create({
        credentialDefinitionId,
        keyCorrectnessProof: keyCorrectnessProofRecord?.value,
        schemaId: credentialDefinitionRecord.credentialDefinition.schemaId,
      })

      return credentialOffer.toJson() as unknown as AnonCredsCredentialOffer
    } finally {
      credentialOffer?.handle.clear()
    }
  }

  public async createCredential(
    agentContext: AgentContext,
    options: CreateCredentialOptions
  ): Promise<CreateCredentialReturn> {
    const { tailsFilePath, credentialOffer, credentialRequest, credentialValues, revocationRegistryId } = options

    let credential: Credential | undefined
    try {
      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      const attributeRawValues: Record<string, string> = {}
      const attributeEncodedValues: Record<string, string> = {}

      Object.keys(credentialValues).forEach((key) => {
        attributeRawValues[key] = credentialValues[key].raw
        attributeEncodedValues[key] = credentialValues[key].encoded
      })

      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      const credentialDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionPrivateRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      credential = Credential.create({
        credentialDefinition: credentialDefinitionRecord.credentialDefinition as unknown as JsonObject,
        credentialOffer: credentialOffer as unknown as JsonObject,
        credentialRequest: credentialRequest as unknown as JsonObject,
        revocationRegistryId,
        attributeEncodedValues,
        attributeRawValues,
        credentialDefinitionPrivate: credentialDefinitionPrivateRecord.value,
      })

      return {
        credential: credential.toJson() as unknown as AnonCredsCredential,
        credentialRevocationId: credential.revocationRegistryIndex?.toString(),
      }
    } finally {
      credential?.handle.clear()
    }
  }
}
