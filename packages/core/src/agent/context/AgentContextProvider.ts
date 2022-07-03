import type { AgentContext } from './AgentContext'

export interface AgentContextProvider {
  /**
   * Get the agent context for an inbound message. It's possible to provide a contextCorrelationId to make it
   * easier for the context provider implementation to correlate inbound messages to the correct context. This can be useful if
   * a plaintext message is passed and the context provider can't determine the context based on the recipient public keys
   * of the inbound message.
   *
   * The implementation of this method could range from a very simple one that always returns the same context to
   * a complex one that manages the context for a multi-tenant agent.
   */
  getContextForInboundMessage(
    inboundMessage: unknown,
    options?: { contextCorrelationId?: string }
  ): Promise<AgentContext>

  /**
   * Get the agent context for a context correlation id. Will throw an error if no AgentContext could be retrieved
   * for the specified contextCorrelationId.
   */
  getAgentContextForContextCorrelationId(contextCorrelationId: string): Promise<AgentContext>
}
