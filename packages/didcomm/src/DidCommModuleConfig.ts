import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import type {
  DidCommConnectionsModuleConfigOptions,
  DidCommCredentialProtocol,
  DidCommMessagePickupModuleConfigOptions,
  DidCommMessagePickupProtocol,
  DidCommProofsModuleConfigOptions,
} from './modules'
import type { DidCommCredentialsModuleConfigOptions } from './modules/credentials/DidCommCredentialsModuleConfig'
import type { DidCommDiscoverFeaturesModuleConfigOptions } from './modules/discover-features/DidCommDiscoverFeaturesModuleConfig'
import type { DidCommProofProtocol } from './modules/proofs/protocol/DidCommProofProtocol'
import type { DidCommMediationRecipientModuleConfigOptions } from './modules/routing/DidCommMediationRecipientModuleConfig'
import type { DidCommMediatorModuleConfigOptions } from './modules/routing/DidCommMediatorModuleConfig'
import {
  type DidCommInboundTransport,
  type DidCommOutboundTransport,
  type DidCommQueueTransportRepository,
  type DidCommTransportSessionRepository,
  InMemoryDidCommQueueTransportRepository,
  InMemoryDidCommTransportSessionRepository,
} from './transport'
import { DidCommMimeType } from './types'

export interface DidCommModuleConfigOptions {
  endpoints?: string[]
  transports?: {
    inbound?: DidCommInboundTransport[]
    outbound?: DidCommOutboundTransport[]
  }
  useDidSovPrefixWhereAllowed?: boolean
  processDidCommMessagesConcurrently?: boolean
  didCommMimeType?: string
  useDidKeyInProtocols?: boolean
  /**
   * Allows to specify a custom transport session repository. It defaults to an in-memory transport session table
   *
   */
  transportSessionRepository?: DidCommTransportSessionRepository

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
  private _inboundTransports: DidCommInboundTransport[]
  private _outboundTransports: DidCommOutboundTransport[]
  private _transportSessionRepository: DidCommTransportSessionRepository
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
    this._transportSessionRepository = options?.transportSessionRepository ?? new InMemoryDidCommTransportSessionRepository()
    this._inboundTransports = options?.transports?.inbound ?? []
    this._outboundTransports = options?.transports?.outbound ?? []
    this._queueTransportRepository = options?.queueTransportRepository ?? new InMemoryDidCommQueueTransportRepository()

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

  public get inboundTransports() {
    return this._inboundTransports
  }

  public set inboundTransports(inboundTransports: DidCommInboundTransport[]) {
    this._inboundTransports = inboundTransports
  }

  public get outboundTransports() {
    return this._outboundTransports
  }

  public set outboundTransports(outboundTransports: DidCommOutboundTransport[]) {
    this._outboundTransports = outboundTransports
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

  /** See {@link DidCommModuleConfig.transportSessionRepository} */
  public get transportSessionRepository() {
    return this._transportSessionRepository
  }

  /**
   * Allows to specify a custom queue transport queue. It defaults to an in-memory queue
   *
   */
  public get queueTransportRepository() {
    return this._queueTransportRepository
  }
}
