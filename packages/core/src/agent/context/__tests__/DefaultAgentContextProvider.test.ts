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
  })
})
