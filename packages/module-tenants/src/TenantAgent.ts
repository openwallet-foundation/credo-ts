import type { AgentContext } from '@aries-framework/core'

import { AriesFrameworkError, BaseAgent } from '@aries-framework/core'

export class TenantAgent extends BaseAgent {
  private isDestroyed = false

  public constructor(agentContext: AgentContext) {
    super(agentContext.config, agentContext.dependencyManager)
  }

  public async initialize() {
    if (this.isDestroyed) {
      throw new AriesFrameworkError("Can't initialize agent after it has been destroyed")
    }

    await super.initialize()
    this._isInitialized = true
  }

  public async destroy() {
    this.logger.trace(
      `Destroying tenant agent context with contextCorrelationId '${this.agentContext.contextCorrelationId}'`
    )
    await this.agentContext.endSession()
    this._isInitialized = false
    this.isDestroyed = true
  }

  protected registerDependencies() {
    // Nothing to do here
  }
}
