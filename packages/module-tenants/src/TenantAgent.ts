import type { AgentContext } from '@aries-framework/core'

import { AriesFrameworkError, BaseAgent } from '@aries-framework/core'

export class TenantAgent extends BaseAgent {
  private sessionHasEnded = false

  public constructor(agentContext: AgentContext) {
    super(agentContext.config, agentContext.dependencyManager)
  }

  public async initialize() {
    if (this.sessionHasEnded) {
      throw new AriesFrameworkError("Can't initialize agent after tenant sessions has been ended.")
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

  protected registerDependencies() {
    // Nothing to do here
  }
}
