import type { AgentContext, DefaultAgentModules, ModulesMap } from '@credo-ts/core'

import { BaseAgent, CredoError } from '@credo-ts/core'

export class TenantAgent<AgentModules extends ModulesMap = DefaultAgentModules> extends BaseAgent<AgentModules> {
  private sessionHasEnded = false

  public constructor(agentContext: AgentContext) {
    super(agentContext.config, agentContext.dependencyManager)
  }

  public async initialize() {
    if (this.sessionHasEnded) {
      throw new CredoError("Can't initialize agent after tenant sessions has been ended.")
    }

    await super.initialize()
    this._isInitialized = true
  }

  public async endSession() {
    this.logger.trace(
      `Ending session for agent context with contextCorrelationId '${this.agentContext.contextCorrelationId}'`
    )
    await this.agentContext.endSession()
    this._isInitialized = false
    this.sessionHasEnded = true
  }
}
