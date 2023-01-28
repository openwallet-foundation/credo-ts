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
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { KeyCorrectnessProof } from '@hyperledger/anoncreds-shared'

import { AriesFrameworkError } from '@aries-framework/core'
import {
  Credential,
  CredentialDefinition,
  CredentialOffer,
  Schema,
  CredentialRequest,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../../errors/AnonCredsRsError'

export class AnonCredsRsIssuerService implements AnonCredsIssuerService {
  public async createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
    const { issuerId, name, version, attrNames: attributeNames } = options

    try {
      const schema = Schema.create({
        issuerId,
        name,
        version,
        attributeNames,
      })

      return JSON.parse(schema.toJson()) as AnonCredsSchema
    } catch (error) {
      throw new AnonCredsRsError('Error creating schema', { cause: error })
    }
  }

  public async createCredentialDefinition(
    agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions,
    //metadata?: CreateCredentialDefinitionMetadata
  ): Promise<AnonCredsCredentialDefinition> {
    const { tag, supportRevocation, schema, issuerId, schemaId } = options

    try {
      // TODO: Where to store credentialDefinitionPrivate and keyCorrectnessProof?
      const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } = CredentialDefinition.create({
        schema: Schema.load(JSON.stringify(schema)),
        issuerId,
        schemaId,
        tag,
        supportRevocation,
        signatureType: 'CL',
      })

      return JSON.parse(credentialDefinition.toJson()) as AnonCredsCredentialDefinition
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential definition', { cause: error })
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    const { credentialDefinitionId } = options

    try {
      // TODO: retrieve schemaId and keyCorrectnessProof
      // could be done by using AnonCredsCredentialDefinitionRepository.findById().schemaId and
      // store private part/create other kind of record for KCP
      const credentialOffer = CredentialOffer.create({
        credentialDefinitionId,
        keyCorrectnessProof: {} as KeyCorrectnessProof, // FIXME
        schemaId: '', // FIXME
      })

      return JSON.parse(credentialOffer.toJson()) as AnonCredsCredentialOffer
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential offer', { cause: error })
    }
  }

  public async createCredential(
    agentContext: AgentContext,
    options: CreateCredentialOptions
  ): Promise<CreateCredentialReturn> {
    const { tailsFilePath, credentialOffer, credentialRequest, credentialValues, revocationRegistryId } = options

    try {
      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      const attributeRawValues: Record<string, string> = {}
      const attributeEncodedValues: Record<string, string> = {}

      Object.keys(credentialValues).forEach((key) => {
        attributeRawValues[key] = credentialValues[key].encoded
        attributeEncodedValues[key] = credentialValues[key].raw
      })

      const credential = Credential.create({
        credentialDefinition, // TODO: Get from repository?
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        credentialRequest: CredentialRequest.load(JSON.stringify(credentialRequest)),
        revocationRegistryId,
        attributeEncodedValues,
        attributeRawValues,
        credentialDefinitionPrivate, // TODO: Get from repository?
        //TODO: revocationConfiguration,
      })

      return {
        credential: JSON.parse(credential.toJson()),
        // TODO: credentialRevocationId
      }
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential offer', { cause: error })
    }
  }
}
