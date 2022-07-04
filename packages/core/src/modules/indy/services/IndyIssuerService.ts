import type { FileSystem } from '../../../storage/FileSystem'
import type {
  default as Indy,
  CredDef,
  Schema,
  Cred,
  CredDefId,
  CredOffer,
  CredReq,
  CredRevocId,
  CredValues,
} from 'indy-sdk'

import { AgentConfig } from '../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndySdkError } from '../../../error/IndySdkError'
import { injectable } from '../../../plugins'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'

import { IndyUtilitiesService } from './IndyUtilitiesService'

@injectable()
export class IndyIssuerService {
  private indy: typeof Indy
  private wallet: IndyWallet
  private indyUtilitiesService: IndyUtilitiesService
  private fileSystem: FileSystem

  public constructor(agentConfig: AgentConfig, wallet: IndyWallet, indyUtilitiesService: IndyUtilitiesService) {
    this.indy = agentConfig.agentDependencies.indy
    this.wallet = wallet
    this.indyUtilitiesService = indyUtilitiesService
    this.fileSystem = agentConfig.fileSystem
  }

  /**
   * Create a new credential schema.
   *
   * @returns the schema.
   */
  public async createSchema({ originDid, name, version, attributes }: CreateSchemaOptions): Promise<Schema> {
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
  public async createCredentialDefinition({
    issuerDid,
    schema,
    tag = 'default',
    signatureType = 'CL',
    supportRevocation = false,
  }: CreateCredentialDefinitionOptions): Promise<CredDef> {
    try {
      const [, credentialDefinition] = await this.indy.issuerCreateAndStoreCredentialDef(
        this.wallet.handle,
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
  public async createCredentialOffer(credentialDefinitionId: CredDefId) {
    try {
      return await this.indy.issuerCreateCredentialOffer(this.wallet.handle, credentialDefinitionId)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  /**
   * Create a credential.
   *
   * @returns Credential and revocation id
   */
  public async createCredential({
    credentialOffer,
    credentialRequest,
    credentialValues,
    revocationRegistryId,
    tailsFilePath,
  }: CreateCredentialOptions): Promise<[Cred, CredRevocId]> {
    try {
      // Indy SDK requires tailsReaderHandle. Use null if no tailsFilePath is present
      const tailsReaderHandle = tailsFilePath ? await this.indyUtilitiesService.createTailsReader(tailsFilePath) : 0

      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      const [credential, credentialRevocationId] = await this.indy.issuerCreateCredential(
        this.wallet.handle,
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
