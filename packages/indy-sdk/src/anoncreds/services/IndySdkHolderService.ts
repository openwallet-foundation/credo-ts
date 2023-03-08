import type {
  AnonCredsHolderService,
  AnonCredsProof,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  AnonCredsCredentialInfo,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  AnonCredsSelectedCredentials,
  AnonCredsCredentialRequestMetadata,
  CreateLinkSecretOptions,
  CreateLinkSecretReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type {
  CredentialDefs,
  IndyRequestedCredentials,
  RevStates,
  Schemas,
  IndyCredential as IndySdkCredential,
  CredReqMetadata,
  IndyProofRequest,
} from 'indy-sdk'

import { AnonCredsLinkSecretRepository, generateLegacyProverDidLikeString } from '@aries-framework/anoncreds'
import { AriesFrameworkError, injectable, inject, utils } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { assertIndySdkWallet } from '../../utils/assertIndySdkWallet'
import { parseCredentialDefinitionId } from '../utils/identifiers'
import {
  indySdkCredentialDefinitionFromAnonCreds,
  indySdkRevocationRegistryDefinitionFromAnonCreds,
  indySdkSchemaFromAnonCreds,
} from '../utils/transform'

import { IndySdkRevocationService } from './IndySdkRevocationService'

@injectable()
export class IndySdkHolderService implements AnonCredsHolderService {
  private indySdk: IndySdk
  private indyRevocationService: IndySdkRevocationService

  public constructor(indyRevocationService: IndySdkRevocationService, @inject(IndySdkSymbol) indySdk: IndySdk) {
    this.indySdk = indySdk
    this.indyRevocationService = indyRevocationService
  }

  public async createLinkSecret(
    agentContext: AgentContext,
    options: CreateLinkSecretOptions
  ): Promise<CreateLinkSecretReturn> {
    assertIndySdkWallet(agentContext.wallet)

    const linkSecretId = options.linkSecretId ?? utils.uuid()

    try {
      await this.indySdk.proverCreateMasterSecret(agentContext.wallet.handle, linkSecretId)

      // We don't have the value for the link secret when using the indy-sdk so we can't return it.
      return {
        linkSecretId,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error creating link secret`, {
        error,
        linkSecretId,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, selectedCredentials, schemas } = options

    assertIndySdkWallet(agentContext.wallet)

    const linkSecretRepository = agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository)

    try {
      agentContext.config.logger.debug('Creating Indy Proof')
      const indyRevocationStates: RevStates = await this.indyRevocationService.createRevocationState(
        agentContext,
        proofRequest,
        selectedCredentials,
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
        const { schemaSeqNo } = parseCredentialDefinitionId(credentialDefinitionId)
        seqNoMap[credentialDefinition.schemaId] = Number(schemaSeqNo)
      }

      // Convert AnonCreds schemas to Indy schemas
      const indySchemas: Schemas = {}
      for (const schemaId in schemas) {
        const schema = schemas[schemaId]
        indySchemas[schemaId] = indySdkSchemaFromAnonCreds(schemaId, schema, seqNoMap[schemaId])
      }

      const linkSecretRecord = await linkSecretRepository.findDefault(agentContext)
      if (!linkSecretRecord) {
        // No default link secret
        throw new AriesFrameworkError(
          'No default link secret found. Indy SDK requires a default link secret to be created before creating a proof.'
        )
      }

      const indyProof = await this.indySdk.proverCreateProof(
        agentContext.wallet.handle,
        proofRequest as IndyProofRequest,
        this.parseSelectedCredentials(selectedCredentials),
        linkSecretRecord.linkSecretId,
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
        selectedCredentials,
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
        // The type is typed as a Record<string, unknown> in the indy-sdk, but the anoncreds package contains the correct type
        options.credentialRequestMetadata as unknown as CredReqMetadata,
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

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      const result = await this.indySdk.proverGetCredential(agentContext.wallet.handle, options.credentialId)

      return {
        credentialDefinitionId: result.cred_def_id,
        attributes: result.attrs,
        credentialId: result.referent,
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

    const linkSecretRepository = agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository)

    // We just generate a prover did like string, as it's not used for anything and we don't need
    // to prove ownership of the did. It's deprecated in AnonCreds v1, but kept for backwards compatibility
    const proverDid = generateLegacyProverDidLikeString()

    // If a link secret is specified, use it. Otherwise, attempt to use default link secret
    const linkSecretRecord = options.linkSecretId
      ? await linkSecretRepository.getByLinkSecretId(agentContext, options.linkSecretId)
      : await linkSecretRepository.findDefault(agentContext)

    if (!linkSecretRecord) {
      // No default link secret
      throw new AriesFrameworkError(
        'No link secret provided to createCredentialRequest and no default link secret has been found'
      )
    }

    try {
      const result = await this.indySdk.proverCreateCredentialReq(
        agentContext.wallet.handle,
        proverDid,
        options.credentialOffer,
        // NOTE: Is it safe to use the cred_def_id from the offer? I think so. You can't create a request
        // for a cred def that is not in the offer
        indySdkCredentialDefinitionFromAnonCreds(options.credentialOffer.cred_def_id, options.credentialDefinition),
        linkSecretRecord.linkSecretId
      )

      return {
        credentialRequest: result[0],
        // The type is typed as a Record<string, unknown> in the indy-sdk, but the anoncreds package contains the correct type
        credentialRequestMetadata: result[1] as unknown as AnonCredsCredentialRequestMetadata,
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
        options.proofRequest as IndyProofRequest,
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
            credentialId: credential.cred_info.referent,
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
   * Converts a public api form of {@link AnonCredsSelectedCredentials} interface into a format {@link Indy.IndyRequestedCredentials} that Indy SDK expects.
   **/
  private parseSelectedCredentials(selectedCredentials: AnonCredsSelectedCredentials): IndyRequestedCredentials {
    const indyRequestedCredentials: IndyRequestedCredentials = {
      requested_attributes: {},
      requested_predicates: {},
      self_attested_attributes: {},
    }

    for (const groupName in selectedCredentials.attributes) {
      indyRequestedCredentials.requested_attributes[groupName] = {
        cred_id: selectedCredentials.attributes[groupName].credentialId,
        revealed: selectedCredentials.attributes[groupName].revealed,
        timestamp: selectedCredentials.attributes[groupName].timestamp,
      }
    }

    for (const groupName in selectedCredentials.predicates) {
      indyRequestedCredentials.requested_predicates[groupName] = {
        cred_id: selectedCredentials.predicates[groupName].credentialId,
        timestamp: selectedCredentials.predicates[groupName].timestamp,
      }
    }

    return indyRequestedCredentials
  }
}
