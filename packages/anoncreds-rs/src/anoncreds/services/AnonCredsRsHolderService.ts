import type {
  AnonCredsHolderService,
  AnonCredsProof,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  AnonCredsCredentialInfo,
  CreateMasterSecretOptions,
  CreateMasterSecretReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import { AnonCredsMasterSecretRepository } from '@aries-framework/anoncreds'
import {
  CredentialDefinition,
  CredentialOffer,
  CredentialRequest,
  MasterSecret,
  Presentation,
  PresentationRequest,
  Schema,
} from '@hyperledger/anoncreds-shared'

import { uuid } from '../../../../core/src/utils/uuid'
import { AnonCredsRsError } from '../../errors/AnonCredsRsError'

export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createMasterSecret(
    agentContext: AgentContext,
    options: CreateMasterSecretOptions
  ): Promise<CreateMasterSecretReturn> {
    try {
      return {
        masterSecretId: options.masterSecretId ?? uuid(),
        masterSecretValue: JSON.parse(MasterSecret.create().toJson()).value.ms,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error creating Master Secret`, {
        error,
      })
      throw new AnonCredsRsError('Error creating Master Secret', { cause: error })
    }
  }

  public async createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, requestedCredentials, schemas } = options

    try {
      const rsCredentialDefinitions: Record<string, CredentialDefinition> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = CredentialDefinition.load(JSON.stringify(credentialDefinitions[credDefId]))
      }

      const rsSchemas: Record<string, Schema> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = Schema.load(JSON.stringify(schemas[schemaId]))
      }

      // TODO: Get all requested credentials and take masterSecret. If it's not the same for every credential, throw error
      const masterSecret = 'masterSecret'

      const presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentials: [], //this.parseRequestedCredentials(requestedCredentials), // TODO
        credentialsProve: [], //TODO,
        selfAttest: {}, //TODO
        masterSecret: MasterSecret.load(JSON.parse(masterSecret)),
      })

      return JSON.parse(presentation.toJson())
    } catch (error) {
      agentContext.config.logger.error(`Error creating AnonCreds Proof`, {
        error,
        proofRequest,
        requestedCredentials,
      })
      throw new AnonCredsRsError('Error creating proof', { cause: error })
    }
  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn> {
    const { credentialDefinition, credentialOffer } = options
    try {
      const masterSecretRepository = agentContext.dependencyManager.resolve(AnonCredsMasterSecretRepository)

      // If a master secret is specified, use it. Otherwise, attempt to use default master secret
      const masterSecretRecord = options.masterSecretId
        ? await masterSecretRepository.getByMasterSecretId(agentContext, options.masterSecretId)
        : await masterSecretRepository.findDefault(agentContext)

      if (!masterSecretRecord) {
        // No default master secret: TODO: shall we create a new one?
        throw new AnonCredsRsError('Master Secret not found')
      }

      const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
        credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        proverDid: '', //FIXME: Remove as soon as it is fixed in anoncreds-rs
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: masterSecretRecord.value } })),
        masterSecretId: masterSecretRecord.id,
      })

      return {
        credentialRequest: JSON.parse(credentialRequest.toJson()),
        credentialRequestMetadata: JSON.parse(credentialRequestMetadata.toJson()),
      }
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential request', { cause: error })
    }
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
  }

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
  }

  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn> {
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
  }
}
