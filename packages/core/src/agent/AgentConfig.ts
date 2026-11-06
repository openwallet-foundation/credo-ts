import { DEFAULT_SKEW_TIME } from '../crypto/jose/jwt/JwtPayload'
import type { Logger } from '../logger'
import { ConsoleLogger, LogLevel } from '../logger'
import type { InitConfig } from '../types'
import { type FetchLimits, fetchWithTimeout } from '../utils/fetch'
import type { AgentDependencies } from './AgentDependencies'

export class AgentConfig {
  private initConfig: InitConfig
  public logger: Logger
  public readonly agentDependencies: AgentDependencies
  #agentDependencies: AgentDependencies
  #getTrustedIssuersForVerification?: InitConfig['getTrustedIssuersForVerification']

  public constructor(initConfig: InitConfig, agentDependencies: AgentDependencies) {
    this.initConfig = initConfig
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.Off)
    this.#agentDependencies = agentDependencies
    // Every request through the agent dependencies gets the fetch limits, including those made by libraries
    this.agentDependencies = { ...agentDependencies, fetch: (url, init) => this.fetch(url, init) }

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

  public get fetchLimits(): Required<FetchLimits> {
    return {
      maxResponseBytes: this.initConfig.fetchLimits?.maxResponseBytes ?? 10 * 1024 * 1024,
      timeoutMs: this.initConfig.fetchLimits?.timeoutMs ?? 30000,
    }
  }

  /**
   * Fetch with the agent's {@link fetchLimits}. Pass `maxResponseBytes` or `timeoutMs` to override them for this request.
   */
  public fetch(url: string | URL | Request, init?: RequestInit & FetchLimits): Promise<Response> {
    return fetchWithTimeout(this.#agentDependencies.fetch, url, {
      ...init,
      maxResponseBytes: init?.maxResponseBytes ?? this.fetchLimits.maxResponseBytes,
      timeoutMs: init?.timeoutMs ?? this.fetchLimits.timeoutMs,
    })
  }

  public get getTrustedIssuersForVerification() {
    return this.#getTrustedIssuersForVerification
  }

  public setTrustedIssuersForVerification(fn: InitConfig['getTrustedIssuersForVerification']) {
    this.#getTrustedIssuersForVerification = fn
  }

  public extend(config: Partial<InitConfig>): AgentConfig {
    return new AgentConfig({ ...this.initConfig, logger: this.logger, ...config }, this.#agentDependencies)
  }

  public toJSON() {
    return {
      ...this.initConfig,
      logger: this.logger.logLevel,
      agentDependencies: Boolean(this.agentDependencies),
    }
  }
}
