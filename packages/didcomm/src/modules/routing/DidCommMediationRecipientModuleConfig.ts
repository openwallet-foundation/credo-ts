import type { DidCommMediatorPickupStrategy } from './DidCommMediatorPickupStrategy'

/**
 * MediationRecipientModuleConfigOptions defines the interface for the options of the MediationRecipientModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidCommMediationRecipientModuleConfigOptions {
  /**
   * Strategy to use for picking up messages from the mediator. If no strategy is provided, the agent will use the discover
   * features protocol to determine the best strategy.
   *
   *
   * - `DidCommMediatorPickupStrategy.PickUpV1`         - explicitly pick up messages from the mediator in periodic loops according to [RFC 0212 Pickup Protocol](https://github.com/hyperledger/aries-rfcs/blob/main/features/0212-pickup/README.md)
   * - `DidCommMediatorPickupStrategy.PickUpV2`         - pick up messages from the mediator in periodic loops according to [RFC 0685 Pickup V2 Protocol](https://github.com/hyperledger/aries-rfcs/tree/main/features/0685-pickup-v2/README.md).
   * - `DidCommMediatorPickupStrategy.PickUpV2LiveMode` - pick up messages from the mediator using Live Mode as specified in [RFC 0685 Pickup V2 Protocol](https://github.com/hyperledger/aries-rfcs/tree/main/features/0685-pickup-v2/README.md).
   * - `DidCommMediatorPickupStrategy.Implicit`         - Open a WebSocket with the mediator to implicitly receive messages. (currently used by Aries Cloud Agent Python)
   * - `DidCommMediatorPickupStrategy.None`             - Do not retrieve messages from the mediator automatically. You can launch manual pickup flows afterwards.
   *
   * @default undefined
   */
  mediatorPickupStrategy?: DidCommMediatorPickupStrategy

  /**
   * Interval in milliseconds between picking up message from the mediator. This is only applicable when the pickup protocol v1 or v2 in polling mode
   * are used.
   *
   * @default 5000
   */
  mediatorPollingInterval?: number

  /**
   * Maximum number of messages to retrieve from the mediator in a single batch. This is applicable for both pickup protocol v1 and v2
   * is used.
   *
   * @default 10
   */
  maximumMessagePickup?: number

  /**
   * Initial interval in milliseconds between reconnection attempts when losing connection with the mediator. This value is doubled after
   * each retry, resulting in an exponential backoff strategy.
   *
   * For instance, if maximumMediatorReconnectionIntervalMs is b, the agent will attempt to reconnect after b, 2*b, 4*b, 8*b, 16*b, ... ms.
   *
   * This is only applicable when pickup protocol v2 or implicit pickup is used.
   *
   * @default 100
   */
  baseMediatorReconnectionIntervalMs?: number

  /**
   * Maximum interval in milliseconds between reconnection attempts when losing connection with the mediator.
   *
   * For instance, if maximumMediatorReconnectionIntervalMs is set to 1000 and maximumMediatorReconnectionIntervalMs is set to 10000,
   * the agent will attempt to reconnect after 1000, 2000, 4000, 8000, 10000, ..., 10000 ms.
   *
   * This is only applicable when pickup protocol v2 or implicit pickup is used.
   * @default Number.POSITIVE_INFINITY
   */
  maximumMediatorReconnectionIntervalMs?: number

  /**
   * Invitation url for connection to a mediator. If provided, a connection to the mediator will be made, and the mediator will be set as default.
   * This is meant as the simplest form of connecting to a mediator, if more control is desired the api should be used.
   *
   * Supports both RFC 0434 Out Of Band v1 and RFC 0160 Connections v1 invitations.
   */
  mediatorInvitationUrl?: string
}

export class DidCommMediationRecipientModuleConfig {
  private options: DidCommMediationRecipientModuleConfigOptions

  public constructor(options?: DidCommMediationRecipientModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.mediatorPollingInterval} */
  public get mediatorPollingInterval() {
    return this.options.mediatorPollingInterval ?? 5000
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.mediatorPickupStrategy} */
  public get mediatorPickupStrategy() {
    return this.options.mediatorPickupStrategy
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.maximumMessagePickup} */
  public get maximumMessagePickup() {
    return this.options.maximumMessagePickup ?? 10
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.baseMediatorReconnectionIntervalMs} */
  public get baseMediatorReconnectionIntervalMs() {
    return this.options.baseMediatorReconnectionIntervalMs ?? 100
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.maximumMediatorReconnectionIntervalMs} */
  public get maximumMediatorReconnectionIntervalMs() {
    return this.options.maximumMediatorReconnectionIntervalMs ?? Number.POSITIVE_INFINITY
  }

  /** See {@link DidCommMediationRecipientModuleConfigOptions.mediatorInvitationUrl} */
  public get mediatorInvitationUrl() {
    return this.options.mediatorInvitationUrl
  }
}
