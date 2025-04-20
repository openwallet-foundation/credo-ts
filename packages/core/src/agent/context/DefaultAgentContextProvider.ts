import type { AgentContextProvider } from './AgentContextProvider'

import { CredoError } from '../../error'
import { injectable } from '../../plugins'

import { AgentContext } from './AgentContext'

/**
 * Default implementation of AgentContextProvider.
 *
 * Holds a single `AgentContext` instance that will be used for all messages, i.e. a
 * a single tenant agent.
 */
@injectable()
export class DefaultAgentContextProvider implements AgentContextProvider {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async getAgentContextForContextCorrelationId(contextCorrelationId: string): Promise<AgentContext> {
    if (contextCorrelationId !== this.agentContext.contextCorrelationId) {
      throw new CredoError(
        `Could not get agent context for contextCorrelationId '${contextCorrelationId}'. Only contextCorrelationId '${this.agentContext.contextCorrelationId}' is supported.`
      )
    }

    return this.agentContext
  }

  public async getContextForInboundMessage(
    // We don't need to look at the message as we always use the same context in the default agent context provider
    _: unknown,
    options?: { contextCorrelationId?: string }
  ): Promise<AgentContext> {
    // This will throw an error if the contextCorrelationId does not match with the contextCorrelationId of the agent context property of this class.
    if (options?.contextCorrelationId) {
      return this.getAgentContextForContextCorrelationId(options.contextCorrelationId)
    }

    return this.agentContext
  }

  public async endSessionForAgentContext(agentContext: AgentContext) {
    // Throw an error if the context correlation id does not match to prevent misuse.
    if (agentContext.contextCorrelationId !== this.agentContext.contextCorrelationId) {
      throw new CredoError(
        `Could not end session for agent context with contextCorrelationId '${agentContext.contextCorrelationId}'. Only contextCorrelationId '${this.agentContext.contextCorrelationId}' is provided by this provider.`
      )
    }

    // We won't dispose the agent context as we don't keep track of the total number of sessions for the root agent context.
  }

  public async deleteAgentContext(agentContext: AgentContext): Promise<void> {
    // Throw an error if the context correlation id does not match to prevent misuse.
    if (agentContext.contextCorrelationId !== this.agentContext.contextCorrelationId) {
      throw new CredoError(
        `Could not delete agent context with contextCorrelationId '${agentContext.contextCorrelationId}'. Only contextCorrelationId '${this.agentContext.contextCorrelationId}' is provided by this provider.`
      )
    }

    await agentContext.dependencyManager.deleteAgentContext(agentContext)
  }
}
