import { ModulesMap } from '@credo-ts/core'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import {
  ConnectionsModuleConfigOptions,
  CredentialProtocol,
  CredentialsModuleConfigOptions,
  MessagePickupModuleConfigOptions,
  ProofProtocol,
  ProofsModuleConfigOptions,
} from './modules'
import { DiscoverFeaturesModuleConfigOptions } from './modules/discover-features/DiscoverFeaturesModuleConfig'
import { MessagePickupProtocol } from './modules/message-pickup/protocol/MessagePickupProtocol'
import { MediationRecipientModuleConfigOptions } from './modules/routing/MediationRecipientModuleConfig'
import { MediatorModuleConfigOptions } from './modules/routing/MediatorModuleConfig'
import { InMemoryQueueTransportRepository, QueueTransportRepository } from './transport'
import { DidCommMimeType } from './types'

export interface DidCommModuleConfigOptions {
  endpoints?: string[]
  useDidSovPrefixWhereAllowed?: boolean
  processDidCommMessagesConcurrently?: boolean
  didCommMimeType?: string
  useDidKeyInProtocols?: boolean
  queueTransportRepository?: QueueTransportRepository

  /**
   * Configuration for the connection module.
   *
   * The connection module is always enabled
   */
  connections?: ConnectionsModuleConfigOptions

  /**
   * Configuration for the discover features module.
   *
   * The discover features module is always enabled
   */
  discovery?: DiscoverFeaturesModuleConfigOptions

  /**
   * Configuration for the credentials module
   *
   * The credentials module is enabled by default with
   * the V2ProofsProtocol and the XProofFormatService
   *
   * You can disable the module by passing `false`, or provide a
   * custom configuration to override the default
   *
   * @default true
   */
  credentials?: boolean | CredentialsModuleConfigOptions<CredentialProtocol[]>

  /**
   * Configuration for the proofs module
   *
   * The proofs module is enabled by default with
   * the V2CredentialsProtocol and the XXCredentialFormatService
   *
   * You can disable the module by passing `false`, or provide a
   * custom configuration to override the default
   *
   * @default true
   */
  proofs?: boolean | ProofsModuleConfigOptions<ProofProtocol[]>

  /**
   * Configuration to enable to basic messages module
   *
   * The basic messages module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  basicMessages?: boolean

  /**
   * Configuration for the message pickup module
   *
   * The message pickup module is enabled by default with
   * the V1PickupProtocol and the V2PickupProtocol
   *
   * You can disable the module by passing `false`, or provide a
   * custom configuration to override the default
   *
   * @default true
   */
  messagePickup?: boolean | MessagePickupModuleConfigOptions<MessagePickupProtocol[]>

  /**
   * Configuration or the mediator module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediator?: boolean | MediatorModuleConfigOptions

  /**
   * Configuration for the mediation recipient module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediationRecipient?: boolean | MediationRecipientModuleConfigOptions

  /**
   * Additional modules to register as part of the DIDComm module.
   *
   * NOTE: you should not register any of the default registered modules,
   * only extension modules, such as ActionMenuModule.
   *
   * Additional modules can be accessed on `agent.didcomm.modules.XXX`
   */
  modules?: ModulesMap
}

export class DidCommModuleConfig<Options extends DidCommModuleConfigOptions = DidCommModuleConfigOptions> {
  private options: Options
  private _endpoints?: string[]
  private _queueTransportRepository: QueueTransportRepository

  public readonly enabledModules: {
    oob: true
    connections: true
    discovery: true
    credentials: Options['credentials'] extends false ? false : true
    proofs: Options['proofs'] extends false ? false : true
    messagePickup: Options['messagePickup'] extends false ? false : true
    mediator: Options['mediator'] extends false ? false : true
    mediationRecipient: Options['mediationRecipient'] extends false ? false : true
    basicMessages: Options['basicMessages'] extends false ? false : true
  }

  public constructor(options?: Options) {
    this.options = (options ?? {}) as Options
    this._endpoints = options?.endpoints
    this._queueTransportRepository = options?.queueTransportRepository ?? new InMemoryQueueTransportRepository()

    this.enabledModules = {
      connections: true,
      oob: true,
      discovery: true,
      proofs: this.options.proofs !== false,
      credentials: this.options.credentials !== false,
      messagePickup: this.options.messagePickup !== false,
      mediator: this.options.mediator !== false,
      mediationRecipient: this.options.mediationRecipient !== false,
      basicMessages: this.options.basicMessages !== false,
    } as this['enabledModules']
  }

  public get endpoints(): [string, ...string[]] {
    // if endpoints is not set, return queue endpoint
    // https://github.com/hyperledger/aries-rfcs/issues/405#issuecomment-582612875
    if (!this._endpoints || this._endpoints.length === 0) {
      return [DID_COMM_TRANSPORT_QUEUE]
    }

    return this._endpoints as [string, ...string[]]
  }

  public set endpoints(endpoints: string[]) {
    this._endpoints = endpoints
  }

  public get useDidSovPrefixWhereAllowed() {
    return this.options.useDidSovPrefixWhereAllowed ?? false
  }

  public get processDidCommMessagesConcurrently() {
    return this.options.processDidCommMessagesConcurrently ?? false
  }

  public get didCommMimeType() {
    return this.options.didCommMimeType ?? DidCommMimeType.V1
  }

  /**
   * Encode keys in did:key format instead of 'naked' keys, as stated in Aries RFC 0360.
   *
   * This setting will not be taken into account if the other party has previously used naked keys
   * in a given protocol (i.e. it does not support Aries RFC 0360).
   */
  public get useDidKeyInProtocols() {
    return this.options.useDidKeyInProtocols ?? true
  }

  /**
   * Allows to specify a custom queue transport queue. It defaults to an in-memory queue
   *
   */
  public get queueTransportRepository() {
    return this._queueTransportRepository
  }
}
