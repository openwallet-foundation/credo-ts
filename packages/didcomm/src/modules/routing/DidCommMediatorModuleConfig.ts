import { DidCommMessageForwardingStrategy } from './DidCommMessageForwardingStrategy'
import type { DidCommVersion } from '../../util/didcommVersion'

/**
 * MediatorModuleConfigOptions defines the interface for the options of the MediatorModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidCommMediatorModuleConfigOptions {
  /**
   * Whether to automatically accept and grant incoming mediation requests.
   *
   * @default false
   */
  autoAcceptMediationRequests?: boolean

  /**
   * Mediator's routing DID for Coordinate Mediation 2.0.
   * This is the DID-as-endpoint where senders forward messages.
   * Required for v2 mediate-grant. Typically a did:peer with service_endpoint.
   */
  mediatorRoutingDid?: string

  /**
   * Mediation protocol versions to support. When 'v2' is included, Coordinate Mediation 2.0 handlers are registered.
   *
   * @default ['v1']
   */
  mediationProtocolVersions?: DidCommVersion[]

  /**
   * Strategy to use when a Forward message is received.
   *
   *
   * - `DidCommMessageForwardingStrategy.QueueOnly` - simply queue encrypted message into QueueTransportRepository. It will be in charge of manually trigering DidCommMessagePickupApi.deliver() afterwards.
   * - `DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery` - Queue message into QueueTransportRepository and deliver it (along any other queued message).
   * - `DidCommMessageForwardingStrategy.DirectDelivery` - Deliver message directly. Do not add into queue (it might be manually added after, e.g. in case of failure)
   *
   * @default DidCommMessageForwardingStrategy.DirectDelivery
   * @todo Update default to QueueAndLiveModeDelivery
   */
  messageForwardingStrategy?: DidCommMessageForwardingStrategy
}

export class DidCommMediatorModuleConfig {
  private options: DidCommMediatorModuleConfigOptions

  public constructor(options?: DidCommMediatorModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link DidCommMediatorModuleConfigOptions.autoAcceptMediationRequests} */
  public get autoAcceptMediationRequests() {
    return this.options.autoAcceptMediationRequests ?? false
  }

  /** See {@link DidCommMediatorModuleConfigOptions.mediatorRoutingDid} */
  public get mediatorRoutingDid() {
    return this.options.mediatorRoutingDid
  }

  /** See {@link DidCommMediatorModuleConfigOptions.mediationProtocolVersions} */
  public get mediationProtocolVersions(): DidCommVersion[] {
    return this.options.mediationProtocolVersions ?? ['v1']
  }

  /** See {@link DidCommMediatorModuleConfigOptions.messageForwardingStrategy} */
  public get messageForwardingStrategy() {
    return this.options.messageForwardingStrategy ?? DidCommMessageForwardingStrategy.DirectDelivery
  }
}
