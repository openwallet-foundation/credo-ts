import type { Logger } from '../logger'
import type { InitConfig } from '../types'
import type { AgentDependencies } from './AgentDependencies'

import { ConsoleLogger, LogLevel } from '../logger'

export class AgentConfig {
  private initConfig: InitConfig
  public label: string
  public logger: Logger
  public readonly agentDependencies: AgentDependencies

  public constructor(initConfig: InitConfig, agentDependencies: AgentDependencies) {
    this.initConfig = initConfig
    this.label = initConfig.label
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.off)
    this.agentDependencies = agentDependencies
  }

  public get allowInsecureHttpUrls() {
    return this.initConfig.allowInsecureHttpUrls ?? false
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
      logger: this.logger.logLevel,
      agentDependencies: Boolean(this.agentDependencies),
      label: this.label,
    }
  }
}
