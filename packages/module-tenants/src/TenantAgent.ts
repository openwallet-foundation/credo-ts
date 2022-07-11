import type { AgentContext } from '@aries-framework/core'

import { BaseAgent } from '@aries-framework/core'

export class TenantAgent extends BaseAgent {
  public constructor(agentContext: AgentContext) {
    super(agentContext.config, agentContext.dependencyManager)
  }

  public async initialize() {
    await super.initialize()
    this._isInitialized = true
  }

  public async shutdown() {
    this.logger.debug(
      `Shutting down tenant agent with contextCorrelationId '${this.agentContext.contextCorrelationId}'`
    )
    await super.shutdown()

    this._isInitialized = false
  }

  protected registerDependencies() {
    // Nothing to do here
  }
}
