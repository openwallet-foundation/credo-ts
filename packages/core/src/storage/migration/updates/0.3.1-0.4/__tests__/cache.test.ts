import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import * as testModule from '../cache'

const agentConfig = getAgentConfig('Migration Cache 0.3.1-0.4')
const agentContext = getAgentContext()

const storageService = {
  getAll: vi.fn(),
  deleteById: vi.fn(),
}

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => storageService),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3.1-0.4 | Cache', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateCacheToV0_4()', () => {
    it('should fetch all cache records and remove them ', async () => {
      const records = [{ id: 'first' }, { id: 'second' }]

      mockFunction(storageService.getAll).mockResolvedValue(records)

      await testModule.migrateCacheToV0_4(agent)

      expect(storageService.getAll).toHaveBeenCalledTimes(1)
      expect(storageService.getAll).toHaveBeenCalledWith(agent.context, expect.anything())
      expect(storageService.deleteById).toHaveBeenCalledTimes(2)

      const [, , firstId] = mockFunction(storageService.deleteById).mock.calls[0]
      const [, , secondId] = mockFunction(storageService.deleteById).mock.calls[1]
      expect(firstId).toEqual('first')
      expect(secondId).toEqual('second')
    })
  })
})
