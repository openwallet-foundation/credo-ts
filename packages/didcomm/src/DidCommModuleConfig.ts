import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import {
  DidCommConnectionsModuleConfigOptions,
  DidCommCredentialProtocol,
  DidCommMessagePickupModuleConfigOptions,
  DidCommMessagePickupProtocol,
  DidCommProofsModuleConfigOptions,
} from './modules'
import { DidCommCredentialsModuleConfigOptions } from './modules/credentials/DidCommCredentialsModuleConfig'
import { DidCommDiscoverFeaturesModuleConfigOptions } from './modules/discover-features/DidCommDiscoverFeaturesModuleConfig'
import { DidCommProofProtocol } from './modules/proofs/protocol/DidCommProofProtocol'
import { DidCommMediationRecipientModuleConfigOptions } from './modules/routing/DidCommMediationRecipientModuleConfig'
import { DidCommMediatorModuleConfigOptions } from './modules/routing/DidCommMediatorModuleConfig'
import { DidCommQueueTransportRepository, InMemoryQueueTransportRepository } from './transport'
import { DidCommMimeType } from './types'

export interface DidCommModuleConfigOptions {
  endpoints?: string[]
  useDidSovPrefixWhereAllowed?: boolean
  processDidCommMessagesConcurrently?: boolean
  didCommMimeType?: string
  useDidKeyInProtocols?: boolean
  queueTransportRepository?: DidCommQueueTransportRepository

  /**
   * Configuration for the connection module.
   *
   * The connection module is always enabled
   */
  connections?: DidCommConnectionsModuleConfigOptions

  /**
   * Configuration for the discover features module.
   *
   * The discover features module is always enabled
   */
  discovery?: DidCommDiscoverFeaturesModuleConfigOptions

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
  credentials?: boolean | DidCommCredentialsModuleConfigOptions<DidCommCredentialProtocol[]>

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
  proofs?: boolean | DidCommProofsModuleConfigOptions<DidCommProofProtocol[]>

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
  messagePickup?: boolean | DidCommMessagePickupModuleConfigOptions<DidCommMessagePickupProtocol[]>

  /**
   * Configuration or the mediator module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediator?: boolean | DidCommMediatorModuleConfigOptions

  /**
   * Configuration for the mediation recipient module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediationRecipient?: boolean | DidCommMediationRecipientModuleConfigOptions
}

export class DidCommModuleConfig<Options extends DidCommModuleConfigOptions = DidCommModuleConfigOptions> {
  private options: Options
  private _endpoints?: string[]
  private _queueTransportRepository: DidCommQueueTransportRepository

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
