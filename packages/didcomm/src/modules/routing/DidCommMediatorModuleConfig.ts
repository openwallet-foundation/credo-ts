import { DidCommMessageForwardingStrategy } from './DidCommMessageForwardingStrategy'

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

  /** See {@link DidCommMediatorModuleConfigOptions.messageForwardingStrategy} */
  public get messageForwardingStrategy() {
    return this.options.messageForwardingStrategy ?? DidCommMessageForwardingStrategy.DirectDelivery
  }
}
