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

  /**
   * End sessions for the provided agent context. This does not necessarily mean the wallet will be closed or the dependency manager will
   * be disposed, it is to inform the agent context provider this session for the agent context is no longer in use. This should only be
   * called once for every session and the agent context MUST not be used after this method is called.
   */
  endSessionForAgentContext(agentContext: AgentContext): Promise<void>

  deleteAgentContext(agentContext: AgentContext): Promise<void>
}
