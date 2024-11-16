import type { AgentDependencies } from './AgentDependencies'
import type { Logger } from '../logger'
import type { InitConfig } from '../types'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { ConsoleLogger, LogLevel } from '../logger'
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
  }

  /**
   * @todo move to context configuration
   */
  public get walletConfig() {
    return this.initConfig.walletConfig
  }

  public get didCommMimeType() {
    return this.initConfig.didCommMimeType ?? DidCommMimeType.V1
  }

  public get allowInsecureHttpUrls() {
    return this.initConfig.allowInsecureHttpUrls ?? false
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

  public get backupBeforeStorageUpdate() {
    return this.initConfig.backupBeforeStorageUpdate ?? true
  }

  public get processDidCommMessagesConcurrently() {
    return this.initConfig.processDidCommMessagesConcurrently ?? false
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
