import type {
  AnonCredsHolderService,
  AnonCredsProof,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  CredentialInfo,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  RequestedCredentials,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type {
  Cred,
  CredentialDefs,
  IndyRequestedCredentials,
  RevStates,
  Schemas,
  IndyCredential as IndySdkCredential,
} from 'indy-sdk'

import { inject } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { assertIndySdkWallet } from '../../utils/assertIndySdkWallet'
import { getIndySeqNoFromUnqualifiedCredentialDefinitionId } from '../utils/identifiers'
import {
  indySdkCredentialDefinitionFromAnonCreds,
  indySdkRevocationRegistryDefinitionFromAnonCreds,
  indySdkSchemaFromAnonCreds,
} from '../utils/transform'

import { IndySdkRevocationService } from './IndySdkRevocationService'

export class IndySdkHolderService implements AnonCredsHolderService {
  private indySdk: IndySdk
  private indyRevocationService: IndySdkRevocationService

  public constructor(indyRevocationService: IndySdkRevocationService, @inject(IndySdkSymbol) indySdk: IndySdk) {
    this.indySdk = indySdk
    this.indyRevocationService = indyRevocationService
  }

  public async createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, requestedCredentials, schemas } = options

    assertIndySdkWallet(agentContext.wallet)

    try {
      agentContext.config.logger.debug('Creating Indy Proof')
      const indyRevocationStates: RevStates = await this.indyRevocationService.createRevocationState(
        agentContext,
        proofRequest,
        requestedCredentials,
        options.revocationRegistries
      )

      // The AnonCredsSchema doesn't contain the seqNo anymore. However, the indy credential definition id
      // does contain the seqNo, so we can extract it from the credential definition id.
      const seqNoMap: { [schemaId: string]: number } = {}

      // Convert AnonCreds credential definitions to Indy credential definitions
      const indyCredentialDefinitions: CredentialDefs = {}
      for (const credentialDefinitionId in credentialDefinitions) {
        const credentialDefinition = credentialDefinitions[credentialDefinitionId]
        indyCredentialDefinitions[credentialDefinitionId] = indySdkCredentialDefinitionFromAnonCreds(
          credentialDefinitionId,
          credentialDefinition
        )

        // Get the seqNo for the schemas so we can use it when transforming the schemas
        const schemaSeqNo = getIndySeqNoFromUnqualifiedCredentialDefinitionId(credentialDefinitionId)
        seqNoMap[credentialDefinition.schemaId] = schemaSeqNo
      }

      // Convert AnonCreds schemas to Indy schemas
      const indySchemas: Schemas = {}
      for (const schemaId in schemas) {
        const schema = schemas[schemaId]
        indySchemas[schemaId] = indySdkSchemaFromAnonCreds(schemaId, schema, seqNoMap[schemaId])
      }

      const indyProof = await this.indySdk.proverCreateProof(
        agentContext.wallet.handle,
        proofRequest,
        this.parseRequestedCredentials(requestedCredentials),
        agentContext.wallet.masterSecretId,
        indySchemas,
        indyCredentialDefinitions,
        indyRevocationStates
      )

      agentContext.config.logger.trace('Created Indy Proof', {
        indyProof,
      })

      return indyProof
    } catch (error) {
      agentContext.config.logger.error(`Error creating Indy Proof`, {
        error,
        proofRequest,
        requestedCredentials,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    assertIndySdkWallet(agentContext.wallet)

    const indyRevocationRegistryDefinition = options.revocationRegistry
      ? indySdkRevocationRegistryDefinitionFromAnonCreds(
          options.revocationRegistry.id,
          options.revocationRegistry.definition
        )
      : null

    try {
      return await this.indySdk.proverStoreCredential(
        agentContext.wallet.handle,
        options.credentialId ?? null,
        options.credentialRequestMetadata,
        options.credential,
        indySdkCredentialDefinitionFromAnonCreds(options.credentialDefinitionId, options.credentialDefinition),
        indyRevocationRegistryDefinition
      )
    } catch (error) {
      agentContext.config.logger.error(`Error storing Indy Credential '${options.credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getCredential(agentContext: AgentContext, options: GetCredentialOptions): Promise<CredentialInfo> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      const result = await this.indySdk.proverGetCredential(agentContext.wallet.handle, options.credentialId)

      return {
        credentialDefinitionId: result.cred_def_id,
        attributes: result.attrs,
        referent: result.referent,
        schemaId: result.schema_id,
        credentialRevocationId: result.cred_rev_id,
        revocationRegistryId: result.rev_reg_id,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error getting Indy Credential '${options.credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      const result = await this.indySdk.proverCreateCredentialReq(
        agentContext.wallet.handle,
        options.holderDid,
        options.credentialOffer,
        // NOTE: Is it safe to use the cred_def_id from the offer? I think so. You can't create a request
        // for a cred def that is not in the offer
        indySdkCredentialDefinitionFromAnonCreds(options.credentialOffer.cred_def_id, options.credentialDefinition),
        // FIXME: we need to remove the masterSecret from the wallet, as it is AnonCreds specific
        // Issue: https://github.com/hyperledger/aries-framework-javascript/issues/1198
        agentContext.wallet.masterSecretId
      )

      return {
        credentialRequest: result[0],
        credentialRequestMetadata: result[1],
      }
    } catch (error) {
      agentContext.config.logger.error(`Error creating Indy Credential Request`, {
        error,
        credentialOffer: options.credentialOffer,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      return await this.indySdk.proverDeleteCredential(agentContext.wallet.handle, credentialId)
    } catch (error) {
      agentContext.config.logger.error(`Error deleting Indy Credential from Wallet`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      // Open indy credential search
      const searchHandle = await this.indySdk.proverSearchCredentialsForProofReq(
        agentContext.wallet.handle,
        options.proofRequest,
        options.extraQuery ?? null
      )

      const start = options.start ?? 0

      try {
        // Make sure database cursors start at 'start' (bit ugly, but no way around in indy)
        if (start > 0) {
          await this.fetchCredentialsForReferent(agentContext, searchHandle, options.attributeReferent, start)
        }

        // Fetch the credentials
        const credentials = await this.fetchCredentialsForReferent(
          agentContext,
          searchHandle,
          options.attributeReferent,
          options.limit
        )

        // TODO: sort the credentials (irrevocable first)
        return credentials.map((credential) => ({
          credentialInfo: {
            credentialDefinitionId: credential.cred_info.cred_def_id,
            referent: credential.cred_info.referent,
            attributes: credential.cred_info.attrs,
            schemaId: credential.cred_info.schema_id,
            revocationRegistryId: credential.cred_info.rev_reg_id,
            credentialRevocationId: credential.cred_info.cred_rev_id,
          },
          interval: credential.interval,
        }))
      } finally {
        // Always close search
        await this.indySdk.proverCloseCredentialsSearchForProofReq(searchHandle)
      }
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
    }
  }

  private async fetchCredentialsForReferent(
    agentContext: AgentContext,
    searchHandle: number,
    referent: string,
    limit?: number
  ) {
    try {
      let credentials: IndySdkCredential[] = []

      // Allow max of 256 per fetch operation
      const chunk = limit ? Math.min(256, limit) : 256

      // Loop while limit not reached (or no limit specified)
      while (!limit || credentials.length < limit) {
        // Retrieve credentials
        const credentialsJson = await this.indySdk.proverFetchCredentialsForProofReq(searchHandle, referent, chunk)
        credentials = [...credentials, ...credentialsJson]

        // If the number of credentials returned is less than chunk
        // It means we reached the end of the iterator (no more credentials)
        if (credentialsJson.length < chunk) {
          return credentials
        }
      }

      return credentials
    } catch (error) {
      agentContext.config.logger.error(`Error Fetching Indy Credentials For Referent`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Converts a public api form of {@link RequestedCredentials} interface into a format {@link Indy.IndyRequestedCredentials} that Indy SDK expects.
   **/
  private parseRequestedCredentials(requestedCredentials: RequestedCredentials): IndyRequestedCredentials {
    const indyRequestedCredentials: IndyRequestedCredentials = {
      requested_attributes: {},
      requested_predicates: {},
      self_attested_attributes: {},
    }

    for (const groupName in requestedCredentials.requestedAttributes) {
      indyRequestedCredentials.requested_attributes[groupName] = {
        cred_id: requestedCredentials.requestedAttributes[groupName].credentialId,
        revealed: requestedCredentials.requestedAttributes[groupName].revealed,
        timestamp: requestedCredentials.requestedAttributes[groupName].timestamp,
      }
    }

    for (const groupName in requestedCredentials.requestedPredicates) {
      indyRequestedCredentials.requested_predicates[groupName] = {
        cred_id: requestedCredentials.requestedPredicates[groupName].credentialId,
        timestamp: requestedCredentials.requestedPredicates[groupName].timestamp,
      }
    }

    return indyRequestedCredentials
  }
}
