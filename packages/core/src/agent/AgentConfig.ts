import type { AgentDependencies } from './AgentDependencies'
import type { Logger } from '../logger'
import type { InitConfig } from '../types'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { AriesFrameworkError } from '../error'
import { ConsoleLogger, LogLevel } from '../logger'
import { AutoAcceptCredential } from '../modules/credentials/models/CredentialAutoAcceptType'
import { AutoAcceptProof } from '../modules/proofs/models/ProofAutoAcceptType'
import { DidCommMimeType } from '../types'

export class AgentConfig {
  private initConfig: InitConfig
  private _endpoints: string[] | undefined
  public label: string
  public logger: Logger
  public readonly agentDependencies: AgentDependencies

  public constructor(initConfig: InitConfig, agentDependencies: AgentDependencies) {
    this.initConfig = initConfig
    this._endpoints = initConfig.endpoints
    this.label = initConfig.label
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.off)
    this.agentDependencies = agentDependencies

    const { mediatorConnectionsInvite, clearDefaultMediator, defaultMediatorId } = this.initConfig

    const allowOne = [mediatorConnectionsInvite, clearDefaultMediator, defaultMediatorId].filter((e) => e !== undefined)
    if (allowOne.length > 1) {
      throw new AriesFrameworkError(
        `Only one of 'mediatorConnectionsInvite', 'clearDefaultMediator' and 'defaultMediatorId' can be set as they negate each other`
      )
    }
  }

  /**
   * @todo move to context configuration
   */
  public get walletConfig() {
    return this.initConfig.walletConfig
  }

  /**
   * @deprecated use autoAcceptConnections from the `ConnectionsModuleConfig` class
   */
  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false
  }

  /**
   * @deprecated use autoAcceptProofs from the `ProofsModuleConfig` class
   */
  public get autoAcceptProofs() {
    return this.initConfig.autoAcceptProofs ?? AutoAcceptProof.Never
  }

  /**
   * @deprecated use autoAcceptCredentials from the `CredentialsModuleConfig` class
   */
  public get autoAcceptCredentials() {
    return this.initConfig.autoAcceptCredentials ?? AutoAcceptCredential.Never
  }

  public get didCommMimeType() {
    return this.initConfig.didCommMimeType ?? DidCommMimeType.V1
  }

  /**
   * @deprecated use mediatorPollingInterval from the `RecipientModuleConfig` class
   */
  public get mediatorPollingInterval() {
    return this.initConfig.mediatorPollingInterval ?? 5000
  }

  /**
   * @deprecated use mediatorPickupStrategy from the `RecipientModuleConfig` class
   */
  public get mediatorPickupStrategy() {
    return this.initConfig.mediatorPickupStrategy
  }

  /**
   * @deprecated use maximumMessagePickup from the `RecipientModuleConfig` class
   */
  public get maximumMessagePickup() {
    return this.initConfig.maximumMessagePickup ?? 10
  }
  /**
   * @deprecated use baseMediatorReconnectionIntervalMs from the `RecipientModuleConfig` class
   */
  public get baseMediatorReconnectionIntervalMs() {
    return this.initConfig.baseMediatorReconnectionIntervalMs ?? 100
  }

  /**
   * @deprecated use maximumMediatorReconnectionIntervalMs from the `RecipientModuleConfig` class
   */
  public get maximumMediatorReconnectionIntervalMs() {
    return this.initConfig.maximumMediatorReconnectionIntervalMs ?? Number.POSITIVE_INFINITY
  }

  /**
   * Encode keys in did:key format instead of 'naked' keys, as stated in Aries RFC 0360.
   *
   * This setting will not be taken into account if the other party has previously used naked keys
   * in a given protocol (i.e. it does not support Aries RFC 0360).
   */
  public get useDidKeyInProtocols() {
    return this.initConfig.useDidKeyInProtocols ?? true
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

  /**
   * @deprecated use mediatorInvitationUrl from the `RecipientModuleConfig` class
   */
  public get mediatorConnectionsInvite() {
    return this.initConfig.mediatorConnectionsInvite
  }

  /**
   * @deprecated use autoAcceptMediationRequests from the `MediatorModuleConfig` class
   */
  public get autoAcceptMediationRequests() {
    return this.initConfig.autoAcceptMediationRequests ?? false
  }

  /**
   * @deprecated you can use `RecipientApi.setDefaultMediator` to set the default mediator.
   */
  public get defaultMediatorId() {
    return this.initConfig.defaultMediatorId
  }

  /**
   * @deprecated you can set the `default` tag to `false` (or remove it completely) to clear the default mediator.
   */
  public get clearDefaultMediator() {
    return this.initConfig.clearDefaultMediator ?? false
  }

  public get useDidSovPrefixWhereAllowed() {
    return this.initConfig.useDidSovPrefixWhereAllowed ?? false
  }

  /**
   * @todo move to context configuration
   */
  public get connectionImageUrl() {
    return this.initConfig.connectionImageUrl
  }

  public get autoUpdateStorageOnStartup() {
    return this.initConfig.autoUpdateStorageOnStartup ?? false
  }

  public extend(config: Partial<InitConfig>): AgentConfig {
    return new AgentConfig(
      { ...this.initConfig, logger: this.logger, label: this.label, ...config },
      this.agentDependencies
    )
  }

  public toJSON() {
    return {
      ...this.initConfig,
      walletConfig: {
        ...this.walletConfig,
        key: this.walletConfig?.key ? '[*****]' : undefined,
        storage: {
          ...this.walletConfig?.storage,
          credentials: this.walletConfig?.storage?.credentials ? '[*****]' : undefined,
        },
      },
      logger: this.logger.logLevel,
      agentDependencies: Boolean(this.agentDependencies),
      label: this.label,
    }
  }
}
