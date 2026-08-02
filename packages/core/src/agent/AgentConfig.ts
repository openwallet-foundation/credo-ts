import { DEFAULT_SKEW_TIME } from '../crypto/jose/jwt/JwtPayload'
import type { Logger } from '../logger'
import { ConsoleLogger, LogLevel } from '../logger'
import type { InitConfig } from '../types'
import type { AgentDependencies } from './AgentDependencies'

export class AgentConfig {
  private initConfig: InitConfig
  public logger: Logger
  public readonly agentDependencies: AgentDependencies
  #getTrustedIssuersForVerification?: InitConfig['getTrustedIssuersForVerification']

  public constructor(initConfig: InitConfig, agentDependencies: AgentDependencies) {
    this.initConfig = initConfig
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.Off)
    this.agentDependencies = agentDependencies

    if (initConfig?.getTrustedIssuersForVerification) {
      this.setTrustedIssuersForVerification(initConfig.getTrustedIssuersForVerification)
    }
  }

  public get allowInsecureHttpUrls() {
    return this.initConfig.allowInsecureHttpUrls ?? false
  }

  public get autoUpdateStorageOnStartup() {
    return this.initConfig.autoUpdateStorageOnStartup ?? false
  }

  public get validitySkewSeconds() {
    return this.initConfig.validitySkewSeconds ?? DEFAULT_SKEW_TIME
  }

  public get getTrustedIssuersForVerification() {
    return this.#getTrustedIssuersForVerification
  }

  public setTrustedIssuersForVerification(fn: InitConfig['getTrustedIssuersForVerification']) {
    this.#getTrustedIssuersForVerification = fn
  }

  public extend(config: Partial<InitConfig>): AgentConfig {
    return new AgentConfig({ ...this.initConfig, logger: this.logger, ...config }, this.agentDependencies)
  }

  public toJSON() {
    return {
      ...this.initConfig,
      logger: this.logger.logLevel,
      agentDependencies: Boolean(this.agentDependencies),
    }
  }
}
