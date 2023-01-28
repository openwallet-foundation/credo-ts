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
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import { CredentialDefinition, CredentialOffer, CredentialRequest, Presentation, PresentationRequest, Schema } from '@hyperledger/anoncreds-shared'
import { AnonCredsRsError } from '../../errors/AnonCredsRsError'

export class AnonCredsRsHolderService implements AnonCredsHolderService {
  indySdk: any
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

      const presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentials: this.parseRequestedCredentials(requestedCredentials), // TODO
        credentialsProve: //TODO,
        selfAttest,  //TODO
        masterSecret: // TODO
      })

      return JSON.parse(presentation.toJson())
    } catch (error) {
      agentContext.config.logger.error(`Error creating Indy Proof`, {
        error,
        proofRequest,
        requestedCredentials,
      })
      throw new AnonCredsRsError('Error creating proof', { cause: error })    }
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {

    // TODO: Call Repositories from here? Or should be done by AnonCredsApi?
    // 
  }

  public async getCredential(agentContext: AgentContext, options: GetCredentialOptions): Promise<CredentialInfo> {

    // TODO: Call Repositories from here? Or should be done by AnonCredsApi?
    //     

  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn> {

    const { credentialDefinition, credentialOffer } = options
    try {

      const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
        credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        proverDid, // TODO and why proverDid? Shouldnt be holderdid?
        masterSecret, // TODO
        masterSecretId, // TODO
      })

      return {
        credentialRequest: JSON.parse(credentialRequest.toJson()),
        credentialRequestMetadata: JSON.parse(credentialRequestMetadata.toJson())
      }
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential request', { cause: error })
    }
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {

    // TODO: Call Repositories from here? Or should be done by AnonCredsApi?
    //     

  }

  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn> {

    // TODO: Call Repositories from here? Or should be done by AnonCredsApi?
    //
  }
}
