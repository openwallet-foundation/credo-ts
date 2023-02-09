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
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import {
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRepository,
} from '@aries-framework/anoncreds'
import { injectable, AriesFrameworkError } from '@aries-framework/core'
import {
  Credential,
  CredentialDefinition,
  CredentialDefinitionPrivate,
  CredentialRequest,
  CredentialOffer,
  KeyCorrectnessProof,
  Schema,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
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
    options: CreateCredentialDefinitionOptions
  ): Promise<CreateCredentialDefinitionReturn> {
    const { tag, supportRevocation, schema, issuerId, schemaId } = options

    try {
      const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } = CredentialDefinition.create({
        schema: Schema.load(JSON.stringify(schema)),
        issuerId,
        schemaId,
        tag,
        supportRevocation,
        signatureType: 'CL',
      })

      return {
        credentialDefinition: JSON.parse(credentialDefinition.toJson()) as AnonCredsCredentialDefinition,
        credentialDefinitionPrivate: JSON.parse(credentialDefinitionPrivate.toJson()),
        keyCorrectnessProof: JSON.parse(keyCorrectnessProof.toJson()),
      }
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
      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      const keyCorrectnessProofRecord = await agentContext.dependencyManager
        .resolve(AnonCredsKeyCorrectnessProofRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      if (!credentialDefinitionRecord) {
        throw new AnonCredsRsError(`Credential Definition ${credentialDefinitionId} not found`)
      }

      const credentialOffer = CredentialOffer.create({
        credentialDefinitionId,
        keyCorrectnessProof: KeyCorrectnessProof.load(JSON.stringify(keyCorrectnessProofRecord?.value)),
        schemaId: credentialDefinitionRecord.credentialDefinition.schemaId,
      })

      return JSON.parse(credentialOffer.toJson()) as AnonCredsCredentialOffer
    } catch (error) {
      throw new AnonCredsRsError(`Error creating credential offer: ${error}`, { cause: error })
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
        attributeRawValues[key] = credentialValues[key].raw
        attributeEncodedValues[key] = credentialValues[key].encoded
      })

      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      const credentialDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionPrivateRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      const credential = Credential.create({
        credentialDefinition: CredentialDefinition.load(
          JSON.stringify(credentialDefinitionRecord.credentialDefinition)
        ),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        credentialRequest: CredentialRequest.load(JSON.stringify(credentialRequest)),
        revocationRegistryId,
        attributeEncodedValues,
        attributeRawValues,
        credentialDefinitionPrivate: CredentialDefinitionPrivate.load(
          JSON.stringify(credentialDefinitionPrivateRecord.value)
        ),
      })

      return {
        credential: JSON.parse(credential.toJson()),
        credentialRevocationId: credential.revocationRegistryIndex?.toString(),
      }
    } catch (error) {
      throw new AnonCredsRsError(`Error creating credential: ${error}`, { cause: error })
    }
  }
}
