import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import {
  ConnectionsModuleConfigOptions,
  CredentialProtocol,
  CredentialsModuleConfigOptions,
  DifPresentationExchangeProofFormatService,
  JsonLdCredentialFormatService,
  MessagePickupModuleOptions,
  ProofProtocol,
  ProofsModuleConfigOptions,
  V1MessagePickupProtocol,
  V2CredentialProtocol,
  V2MessagePickupProtocol,
  V2ProofProtocol,
} from './modules'
import { MessagePickupProtocol } from './modules/message-pickup/protocol/MessagePickupProtocol'
import { MediationRecipientModuleConfigOptions } from './modules/routing/MediationRecipientModuleConfig'
import { MediatorModuleConfigOptions } from './modules/routing/MediatorModuleConfig'
import { InMemoryQueueTransportRepository, QueueTransportRepository } from './transport'
import { DidCommMimeType } from './types'

export type DidCommDefaultModuleMap = {
  basicMessages: true
  proofs: true
  credentials: true
  messagePickup: true
  mediator: true
  mediationRecipient: true
}

export type DidCommModuleMap<
  PP extends ProofProtocol[],
  CP extends CredentialProtocol[],
  MPP extends MessagePickupProtocol[],
> = {
  basicMessages: boolean
  proofs: ProofsModuleConfigOptions<PP> | boolean
  credentials: CredentialsModuleConfigOptions<CP> | boolean
  messagePickup: MessagePickupModuleOptions<MPP> | boolean
  mediator: MediatorModuleConfigOptions | boolean
  mediationRecipient?: MediationRecipientModuleConfigOptions | boolean
}

export interface DidCommModuleConfigOptions<
  ModuleMap extends DidCommModuleMap<PP, CP, MPP> = DidCommDefaultModuleMap,
  PP extends ProofProtocol[] = [V2ProofProtocol<[DifPresentationExchangeProofFormatService]>],
  CP extends CredentialProtocol[] = [V2CredentialProtocol<[JsonLdCredentialFormatService]>],
  MPP extends MessagePickupProtocol[] = [V1MessagePickupProtocol, V2MessagePickupProtocol],
> {
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
  credentials?: ModuleMap['credentials']

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
  proofs?: ModuleMap['proofs']

  /**
   * Configuration to enable to basic messages module
   *
   * The basic messages module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  basicMessages?: ModuleMap['basicMessages']

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
  messagePickup?: ModuleMap['messagePickup']

  /**
   * Configuration or the mediator module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediator?: ModuleMap['mediator']

  /**
   * Configuration for the mediation recipient module
   *
   * The mediator module is enabled by default,
   * but can be disabled by passing `false`
   *
   * @default true
   */
  mediationRecipient?: ModuleMap['mediationRecipient']
}

export class DidCommModuleConfig {
  private options: DidCommModuleConfigOptions
  private _endpoints?: string[]
  private _queueTransportRepository: QueueTransportRepository

  public constructor(options?: DidCommModuleConfigOptions) {
    this.options = options ?? {}
    this._endpoints = options?.endpoints
    this._queueTransportRepository = options?.queueTransportRepository ?? new InMemoryQueueTransportRepository()
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
