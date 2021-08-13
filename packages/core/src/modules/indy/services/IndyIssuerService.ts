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

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndyWallet } from '../../../wallet/IndyWallet'

import { IndyUtilitesService } from './indyUtilitiesService'

@scoped(Lifecycle.ContainerScoped)
export class IndyIssuerService {
  private indy: typeof Indy
  private indyWallet: IndyWallet
  private indyUtilitiesService: IndyUtilitesService
  private fileSystem: FileSystem

  public constructor(agentConfig: AgentConfig, indyWallet: IndyWallet, indyUtilitiesService: IndyUtilitesService) {
    this.indy = agentConfig.agentDependencies.indy
    this.indyWallet = indyWallet
    this.indyUtilitiesService = indyUtilitiesService
    this.fileSystem = agentConfig.fileSystem
  }

  /**
   * Create a new credential schema.
   *
   * @returns the schema.
   */
  public async createSchema({ originDid, name, version, attributes }: CreateSchemaOptions): Promise<Schema> {
    const [, schema] = await this.indy.issuerCreateSchema(originDid, name, version, attributes)

    return schema
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
    const [, credentialDefinition] = await this.indy.issuerCreateAndStoreCredentialDef(
      this.indyWallet.walletHandle,
      issuerDid,
      schema,
      tag,
      signatureType,
      {
        support_revocation: supportRevocation,
      }
    )

    return credentialDefinition
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  public async createCredentialOffer(credentialDefinitionId: CredDefId) {
    return this.indy.issuerCreateCredentialOffer(this.indyWallet.walletHandle, credentialDefinitionId)
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
    // Indy SDK requires tailsReaderHandle. Use null if no tailsFilePath is present
    const tailsReaderHandle = tailsFilePath ? await this.indyUtilitiesService.createTailsReader(tailsFilePath) : 0

    if (revocationRegistryId || tailsFilePath) {
      throw new Error('Revocation not supported yet')
    }

    const [credential, credentialRevocationId] = await this.indy.issuerCreateCredential(
      this.indyWallet.walletHandle,
      credentialOffer,
      credentialRequest,
      credentialValues,
      revocationRegistryId ?? null,
      tailsReaderHandle
    )

    return [credential, credentialRevocationId]
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
