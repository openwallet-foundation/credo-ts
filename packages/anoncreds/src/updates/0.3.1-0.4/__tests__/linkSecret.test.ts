import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import { AnonCredsLinkSecretRecord } from '../../../repository'
import { AnonCredsLinkSecretRepository } from '../../../repository/AnonCredsLinkSecretRepository'
import * as testModule from '../linkSecret'

const agentConfig = getAgentConfig('AnonCreds Migration - Link Secret - 0.3.1-0.4.0')
const agentContext = getAgentContext()

jest.mock('../../../repository/AnonCredsLinkSecretRepository')
const AnonCredsLinkSecretRepositoryMock = AnonCredsLinkSecretRepository as jest.Mock<AnonCredsLinkSecretRepository>
const linkSecretRepository = new AnonCredsLinkSecretRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => linkSecretRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3.1-0.4.0 | AnonCreds Migration | Link Secret', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateLinkSecretToV0_4()', () => {
    test('creates default link secret record based on wallet id if no default link secret exists', async () => {
      mockFunction(linkSecretRepository.findDefault).mockResolvedValue(null)

      await testModule.migrateLinkSecretToV0_4(agent)

      expect(linkSecretRepository.findDefault).toHaveBeenCalledTimes(1)
    })

    test('does not create default link secret record if default link secret record already exists', async () => {
      mockFunction(linkSecretRepository.findDefault).mockResolvedValue(
        new AnonCredsLinkSecretRecord({
          linkSecretId: 'some-link-secret-id',
        })
      )

      await testModule.migrateLinkSecretToV0_4(agent)

      expect(linkSecretRepository.findDefault).toHaveBeenCalledTimes(1)
      expect(linkSecretRepository.update).toHaveBeenCalledTimes(0)
    })
  })
})
