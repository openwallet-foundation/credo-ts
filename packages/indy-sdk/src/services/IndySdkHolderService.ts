import type { CreateCredentialRequestMetadata, CreateProofMetadata } from './IndySdkHolderServiceMetadata'
import type {
  AnonCredsHolderService,
  AnonCredsProof,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  CredentialInfo,
  GetCredentialOptions,
  RequestedCredentials,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type * as Indy from 'indy-sdk'

import {
  JsonTransformer,
  AriesFrameworkError,
  AgentDependencies,
  inject,
  InjectionSymbols,
  Logger,
} from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../error'
import {
  RequestedAttribute as IndyRequestedAttribute,
  RequestedPredicate as IndyRequestedPredicate,
  RequestedCredentials as IndyRequestedCredentials,
} from '../models/proofs'
import { IndyRevocationService } from '../services/IndyRevocationService'
import { assertIndyWallet } from '../util/assertIndyWallet'

export class IndySdkHolderService implements AnonCredsHolderService {
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

  public async createProof(
    agentContext: AgentContext,
    options: CreateProofOptions,
    metadata?: CreateProofMetadata
  ): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, requestedCredentials, revocationStates, schemas } = options

    if (!metadata) {
      throw new AriesFrameworkError('The metadata parameter is required when using Indy, but received undefined.')
    }

    assertIndyWallet(agentContext.wallet)

    const requestedCredentialsClass = this.parseRequestedCredentials(requestedCredentials)

    try {
      this.logger.debug('Creating Indy Proof')
      const revocationStates: Indy.RevStates = await this.indyRevocationService.createRevocationState(
        agentContext,
        proofRequest,
        requestedCredentialsClass
      )

      // Indy expects more schema attributes than defined by the AnonCreds spec.
      // Therefore we need to build the expected schema object by combining the
      // schemas parameter with values passed in the metadata object.
      const indySchemas: Indy.Schemas = {}

      Object.keys(schemas).forEach((key) => {
        indySchemas[key] = {
          id: key, // TODO not sure if this is correct
          name: schemas[key].name,
          version: schemas[key].version,
          attrNames: schemas[key].attrNames,
          seqNo: metadata.schemasMetadata[key].seqNo,
          ver: '1.0',
        }
      })

      // Indy expects more schema attributes than defined by the AnonCreds spec.
      // Therefore we need to build the expected schema object by combining the
      // schemas parameter with values passed in the metadata object.
      const indyCredentialDefinitions: Indy.CredentialDefs = {}

      Object.keys(credentialDefinitions).forEach((key) => {
        indyCredentialDefinitions[key] = {
          id: key, // TODO not sure if this is correct
          schemaId: credentialDefinitions[key].schemaId,
          type: credentialDefinitions[key].type,
          tag: credentialDefinitions[key].tag,
          value: credentialDefinitions[key].value,
          ver: '1.0',
        }
      })

      // const requestedCredentialsClass = this.parseRequestedCredentials(requestedCredentials)

      const indyProof: Indy.IndyProof = await this.indy.proverCreateProof(
        agentContext.wallet.handle,
        proofRequest,
        requestedCredentialsClass.toJSON(),
        agentContext.wallet.masterSecretId,
        indySchemas,
        indyCredentialDefinitions,
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

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    assertIndyWallet(agentContext.wallet)

    const credential = options.credential
    // Indy expects a revocation registry id. Unsure if it can be inferred
    // when absent or throwing an Error is appropriate
    if (!credential.rev_reg_id) {
      throw new AriesFrameworkError('Expected rev_reg_id to be set, but got undefined')
    }

    let revocationRegistryDefinition: Indy.RevocRegDef | null = null

    if (options.revocationRegistryDefinition) {
      revocationRegistryDefinition = {
        id: options.revocationRegistryDefinitionId,
        credDefId: options.revocationRegistryDefinition.credDefId,
        revocDefType: options.revocationRegistryDefinition.type,
        tag: options.revocationRegistryDefinition.tag,
        value: {
          issuanceType: 'ISSUANCE_BY_DEFAULT', // hardcoded to this value because of anoncreds spec. Deltas should be calculated accordingly.
          maxCredNum: options.revocationRegistryDefinition.maxCredNum,
          publicKeys: [options.revocationRegistryDefinition.publicKeys.accumKey.z], // TODO verify this is correct
          tailsHash: options.revocationRegistryDefinition.tailsHash,
          tailsLocation: options.revocationRegistryDefinition.tailsLocation,
        },
        ver: '1.0',
      }
    }

    try {
      return await this.indy.proverStoreCredential(
        agentContext.wallet.handle,
        options.credentialId ?? null,
        options.credentialRequestMetadata,
        {
          ...credential,
          rev_reg_id: credential.rev_reg_id,
        },
        {
          id: options.credentialDefinitionId,
          ver: '1.0',
          ...options.credentialDefinition,
        },
        revocationRegistryDefinition ?? null
      )
    } catch (error) {
      this.logger.error(`Error storing Indy Credential '${options.credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getCredential(agentContext: AgentContext, options: GetCredentialOptions): Promise<CredentialInfo> {
    assertIndyWallet(agentContext.wallet)

    try {
      const result = await this.indy.proverGetCredential(agentContext.wallet.handle, options.credentialId)

      return {
        credentialDefinitionId: result.cred_def_id,
        attributes: result.attrs,
        referent: result.referent,
        schemaId: result.schema_id,
        credentialRevocationId: result.cred_rev_id,
        revocationRegistryId: result.rev_reg_id,
      }
    } catch (error) {
      this.logger.error(`Error getting Indy Credential '${options.credentialId}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions,
    metadata?: CreateCredentialRequestMetadata
  ): Promise<CreateCredentialRequestReturn> {
    assertIndyWallet(agentContext.wallet)

    if (!metadata) {
      throw new AriesFrameworkError('The metadata parameter is required when using Indy, but received undefined.')
    }

    try {
      const result = await this.indy.proverCreateCredentialReq(
        agentContext.wallet.handle,
        options.holderDid,
        options.credentialOffer,
        {
          id: metadata.id,
          ver: '1.0',
          ...options.credentialDefinition,
        },
        agentContext.wallet.masterSecretId
      )

      return {
        credentialRequest: result[0],
        credentialRequestMetadata: result[1],
      }
    } catch (error) {
      this.logger.error(`Error creating Indy Credential Request`, {
        error,
        credentialOffer: options.credentialOffer,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
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

  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn[]> {
    assertIndyWallet(agentContext.wallet)

    try {
      // Open indy credential search
      const searchHandle = await this.indy.proverSearchCredentialsForProofReq(
        agentContext.wallet.handle,
        options.proofRequest,
        options.extraQuery ?? null
      )

      if (!options.start) {
        options.start = 0
      }

      try {
        // Make sure database cursors start at 'start' (bit ugly, but no way around in indy)
        if (options.start > 0) {
          await this.fetchCredentialsForReferent(searchHandle, options.attributeReferent, options.start)
        }

        // Fetch the credentials
        const credentials = await this.fetchCredentialsForReferent(
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
        await this.indy.proverCloseCredentialsSearchForProofReq(searchHandle)
      }
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
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

  /**
   * Converts a {@link IRequestedCredentials} interface to a {@link RequestedCredentials} class instance.
   *
   * The class contains validation and serialization decorators that are used to validate and serialize
   * the object to a format that Indy expects.
   * */
  private parseRequestedCredentials(requestedCredentials: RequestedCredentials): IndyRequestedCredentials {
    const requestedAttributes: Record<string, IndyRequestedAttribute> = {}

    for (const key in requestedCredentials.requestedAttributes) {
      requestedAttributes[key] = JsonTransformer.fromJSON(
        requestedCredentials.requestedAttributes[key],
        IndyRequestedAttribute
      )
    }

    const requestedPredicates: Record<string, IndyRequestedPredicate> = {}

    for (const key in requestedCredentials.requestedPredicates) {
      requestedPredicates[key] = JsonTransformer.fromJSON(
        requestedCredentials.requestedPredicates[key],
        IndyRequestedPredicate
      )
    }

    return new IndyRequestedCredentials({
      requestedAttributes,
      requestedPredicates,
      selfAttestedAttributes: requestedCredentials.selfAttestedAttributes,
    })
  }
}
