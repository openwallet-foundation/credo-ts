import type { AgentContextProvider } from '../AgentContextProvider'

import { getAgentContext } from '../../../../tests/helpers'
import { DefaultAgentContextProvider } from '../DefaultAgentContextProvider'

const agentContext = getAgentContext()

describe('DefaultAgentContextProvider', () => {
  describe('getContextForInboundMessage()', () => {
    test('returns the agent context provided in the constructor', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)

      const message = {}

      await expect(agentContextProvider.getContextForInboundMessage(message)).resolves.toBe(agentContext)
    })

    test('throws an error if the provided contextCorrelationId does not match with the contextCorrelationId from the constructor agent context', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)

      const message = {}

      await expect(
        agentContextProvider.getContextForInboundMessage(message, { contextCorrelationId: 'wrong' })
      ).rejects.toThrow(
        `Could not get agent context for contextCorrelationId 'wrong'. Only contextCorrelationId 'mock' is supported.`
      )
    })
  })

  describe('getAgentContextForContextCorrelationId()', () => {
    test('returns the agent context provided in the constructor if contextCorrelationId matches', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)

      await expect(agentContextProvider.getAgentContextForContextCorrelationId('mock')).resolves.toBe(agentContext)
    })

    test('throws an error if the contextCorrelationId does not match with the contextCorrelationId from the constructor agent context', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)

      await expect(agentContextProvider.getAgentContextForContextCorrelationId('wrong')).rejects.toThrow(
        `Could not get agent context for contextCorrelationId 'wrong'. Only contextCorrelationId 'mock' is supported.`
      )
    })
  })

  describe('endSessionForAgentContext()', () => {
    test('resolves when the correct agent context is passed', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)

      await expect(agentContextProvider.endSessionForAgentContext(agentContext)).resolves.toBeUndefined()
    })

    test('throws an error if the contextCorrelationId does not match with the contextCorrelationId from the constructor agent context', async () => {
      const agentContextProvider: AgentContextProvider = new DefaultAgentContextProvider(agentContext)
      const agentContext2 = getAgentContext({
        contextCorrelationId: 'mock2',
      })

      await expect(agentContextProvider.endSessionForAgentContext(agentContext2)).rejects.toThrow(
        `Could not end session for agent context with contextCorrelationId 'mock2'. Only contextCorrelationId 'mock' is provided by this provider.`
      )
    })
  })
})
