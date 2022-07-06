import type { AgentContext } from '../../../agent'
import type {
  Cred,
  CredDef,
  CredDefId,
  CredOffer,
  CredReq,
  CredRevocId,
  CredValues,
  default as Indy,
  Schema,
} from 'indy-sdk'

import { AgentDependencies } from '../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndySdkError } from '../../../error/IndySdkError'
import { injectable, inject } from '../../../plugins'
import { isIndyError } from '../../../utils/indyError'
import { assertIndyWallet } from '../../../wallet/util/assertIndyWallet'

import { IndyUtilitiesService } from './IndyUtilitiesService'

@injectable()
export class IndyIssuerService {
  private indy: typeof Indy
  private indyUtilitiesService: IndyUtilitiesService

  public constructor(
    indyUtilitiesService: IndyUtilitiesService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies
  ) {
    this.indy = agentDependencies.indy
    this.indyUtilitiesService = indyUtilitiesService
  }

  /**
   * Create a new credential schema.
   *
   * @returns the schema.
   */
  public async createSchema(
    agentContext: AgentContext,
    { originDid, name, version, attributes }: CreateSchemaOptions
  ): Promise<Schema> {
    assertIndyWallet(agentContext.wallet)
    try {
      const [, schema] = await this.indy.issuerCreateSchema(originDid, name, version, attributes)

      return schema
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Create a new credential definition and store it in the wallet.
   *
   * @returns the credential definition.
   */
  public async createCredentialDefinition(
    agentContext: AgentContext,
    {
      issuerDid,
      schema,
      tag = 'default',
      signatureType = 'CL',
      supportRevocation = false,
    }: CreateCredentialDefinitionOptions
  ): Promise<CredDef> {
    assertIndyWallet(agentContext.wallet)
    try {
      const [, credentialDefinition] = await this.indy.issuerCreateAndStoreCredentialDef(
        agentContext.wallet.handle,
        issuerDid,
        schema,
        tag,
        signatureType,
        {
          support_revocation: supportRevocation,
        }
      )

      return credentialDefinition
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  public async createCredentialOffer(agentContext: AgentContext, credentialDefinitionId: CredDefId) {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.issuerCreateCredentialOffer(agentContext.wallet.handle, credentialDefinitionId)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Create a credential.
   *
   * @returns Credential and revocation id
   */
  public async createCredential(
    agentContext: AgentContext,
    {
      credentialOffer,
      credentialRequest,
      credentialValues,
      revocationRegistryId,
      tailsFilePath,
    }: CreateCredentialOptions
  ): Promise<[Cred, CredRevocId]> {
    assertIndyWallet(agentContext.wallet)
    try {
      // Indy SDK requires tailsReaderHandle. Use null if no tailsFilePath is present
      const tailsReaderHandle = tailsFilePath ? await this.indyUtilitiesService.createTailsReader(tailsFilePath) : 0

      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      const [credential, credentialRevocationId] = await this.indy.issuerCreateCredential(
        agentContext.wallet.handle,
        credentialOffer,
        credentialRequest,
        credentialValues,
        revocationRegistryId ?? null,
        tailsReaderHandle
      )

      return [credential, credentialRevocationId]
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}

export interface CreateCredentialDefinitionOptions {
  issuerDid: string
  schema: Schema
  tag?: string
  signatureType?: 'CL'
  supportRevocation?: boolean
}

export interface CreateCredentialOptions {
  credentialOffer: CredOffer
  credentialRequest: CredReq
  credentialValues: CredValues
  revocationRegistryId?: string
  tailsFilePath?: string
}

export interface CreateSchemaOptions {
  originDid: string
  name: string
  version: string
  attributes: string[]
}
