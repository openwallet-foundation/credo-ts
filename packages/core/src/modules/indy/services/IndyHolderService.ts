import type { AgentContext } from '../../../agent'
import type { RequestedCredentials } from '../../proofs'
import type * as Indy from 'indy-sdk'

import { AgentDependencies } from '../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../constants'
import { IndySdkError } from '../../../error/IndySdkError'
import { Logger } from '../../../logger'
import { injectable, inject } from '../../../plugins'
import { isIndyError } from '../../../utils/indyError'
import { assertIndyWallet } from '../../../wallet/util/assertIndyWallet'

import { IndyRevocationService } from './IndyRevocationService'

@injectable()
export class IndyHolderService {
  private indy: typeof Indy
  private logger: Logger
  private indyRevocationService: IndyRevocationService

  public constructor(
    indyRevocationService: IndyRevocationService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies
  ) {
    this.indy = agentDependencies.indy
    this.indyRevocationService = indyRevocationService
    this.logger = logger
  }

  /**
   * Creates an Indy Proof in response to a proof request. Will create revocation state if the proof request requests proof of non-revocation
   *
   * @param proofRequest a Indy proof request
   * @param requestedCredentials the requested credentials to use for the proof creation
   * @param schemas schemas to use in proof creation
   * @param credentialDefinitions credential definitions to use in proof creation
   * @throws {Error} if there is an error during proof generation or revocation state generation
   * @returns a promise of Indy Proof
   *
   * @todo support attribute non_revoked fields
   */
  public async createProof(
    agentContext: AgentContext,
    { proofRequest, requestedCredentials, schemas, credentialDefinitions }: CreateProofOptions
  ): Promise<Indy.IndyProof> {
    assertIndyWallet(agentContext.wallet)
    try {
      this.logger.debug('Creating Indy Proof')
      const revocationStates: Indy.RevStates = await this.indyRevocationService.createRevocationState(
        agentContext,
        proofRequest,
        requestedCredentials
      )

      const indyProof: Indy.IndyProof = await this.indy.proverCreateProof(
        agentContext.wallet.handle,
        proofRequest,
        requestedCredentials.toJSON(),
        agentContext.wallet.masterSecretId,
        schemas,
        credentialDefinitions,
        revocationStates
      )

      this.logger.trace('Created Indy Proof', {
        indyProof,
      })

      return indyProof
    } catch (error) {
      this.logger.error(`Error creating Indy Proof`, {
        error,
        proofRequest,
        requestedCredentials,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Store a credential in the wallet.
   *
   * @returns The credential id
   */
  public async storeCredential(
    agentContext: AgentContext,
    {
      credentialRequestMetadata,
      credential,
      credentialDefinition,
      credentialId,
      revocationRegistryDefinition,
    }: StoreCredentialOptions
  ): Promise<Indy.CredentialId> {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.proverStoreCredential(
        agentContext.wallet.handle,
        credentialId ?? null,
        credentialRequestMetadata,
        credential,
        credentialDefinition,
        revocationRegistryDefinition ?? null
      )
    } catch (error) {
      this.logger.error(`Error storing Indy Credential '${credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Get a credential stored in the wallet by id.
   *
   * @param credentialId the id (referent) of the credential
   * @throws {Error} if the credential is not found
   * @returns the credential
   *
   * @todo handle record not found
   */
  public async getCredential(
    agentContext: AgentContext,
    credentialId: Indy.CredentialId
  ): Promise<Indy.IndyCredentialInfo> {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.proverGetCredential(agentContext.wallet.handle, credentialId)
    } catch (error) {
      this.logger.error(`Error getting Indy Credential '${credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Create a credential request for the given credential offer.
   *
   * @returns The credential request and the credential request metadata
   */
  public async createCredentialRequest(
    agentContext: AgentContext,
    { holderDid, credentialOffer, credentialDefinition }: CreateCredentialRequestOptions
  ): Promise<[Indy.CredReq, Indy.CredReqMetadata]> {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.proverCreateCredentialReq(
        agentContext.wallet.handle,
        holderDid,
        credentialOffer,
        credentialDefinition,
        agentContext.wallet.masterSecretId
      )
    } catch (error) {
      this.logger.error(`Error creating Indy Credential Request`, {
        error,
        credentialOffer,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Retrieve the credentials that are available for an attribute referent in the proof request.
   *
   * @param proofRequest The proof request to retrieve the credentials for
   * @param attributeReferent An attribute referent from the proof request to retrieve the credentials for
   * @param start Starting index
   * @param limit Maximum number of records to return
   *
   * @returns List of credentials that are available for building a proof for the given proof request
   *
   */
  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    { proofRequest, attributeReferent, start = 0, limit = 256, extraQuery }: GetCredentialForProofRequestOptions
  ): Promise<Indy.IndyCredential[]> {
    assertIndyWallet(agentContext.wallet)
    try {
      // Open indy credential search
      const searchHandle = await this.indy.proverSearchCredentialsForProofReq(
        agentContext.wallet.handle,
        proofRequest,
        extraQuery ?? null
      )

      try {
        // Make sure database cursors start at 'start' (bit ugly, but no way around in indy)
        if (start > 0) {
          await this.fetchCredentialsForReferent(searchHandle, attributeReferent, start)
        }

        // Fetch the credentials
        const credentials = await this.fetchCredentialsForReferent(searchHandle, attributeReferent, limit)

        // TODO: sort the credentials (irrevocable first)
        return credentials
      } finally {
        // Always close search
        await this.indy.proverCloseCredentialsSearchForProofReq(searchHandle)
      }
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
    }
  }

  /**
   * Delete a credential stored in the wallet by id.
   *
   * @param credentialId the id (referent) of the credential
   *
   */
  public async deleteCredential(agentContext: AgentContext, credentialId: Indy.CredentialId): Promise<void> {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.proverDeleteCredential(agentContext.wallet.handle, credentialId)
    } catch (error) {
      this.logger.error(`Error deleting Indy Credential from Wallet`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async fetchCredentialsForReferent(searchHandle: number, referent: string, limit?: number) {
    try {
      let credentials: Indy.IndyCredential[] = []

      // Allow max of 256 per fetch operation
      const chunk = limit ? Math.min(256, limit) : 256

      // Loop while limit not reached (or no limit specified)
      while (!limit || credentials.length < limit) {
        // Retrieve credentials
        const credentialsJson = await this.indy.proverFetchCredentialsForProofReq(searchHandle, referent, chunk)
        credentials = [...credentials, ...credentialsJson]

        // If the number of credentials returned is less than chunk
        // It means we reached the end of the iterator (no more credentials)
        if (credentialsJson.length < chunk) {
          return credentials
        }
      }

      return credentials
    } catch (error) {
      this.logger.error(`Error Fetching Indy Credentials For Referent`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}

export interface GetCredentialForProofRequestOptions {
  proofRequest: Indy.IndyProofRequest
  attributeReferent: string
  start?: number
  limit?: number
  extraQuery?: Indy.ReferentWalletQuery
}

export interface CreateCredentialRequestOptions {
  holderDid: string
  credentialOffer: Indy.CredOffer
  credentialDefinition: Indy.CredDef
}

export interface StoreCredentialOptions {
  credentialRequestMetadata: Indy.CredReqMetadata
  credential: Indy.Cred
  credentialDefinition: Indy.CredDef
  credentialId?: Indy.CredentialId
  revocationRegistryDefinition?: Indy.RevocRegDef
}

export interface CreateProofOptions {
  proofRequest: Indy.IndyProofRequest
  requestedCredentials: RequestedCredentials
  schemas: Indy.Schemas
  credentialDefinitions: Indy.CredentialDefs
}
