import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { AgentContext } from '../../../../../agent'
import { Agent } from '../../../../../agent/Agent'
import { DidDocumentRole, DidRecord } from '../../../../../modules/dids'
import { DidRepository } from '../../../../../modules/dids/repository/DidRepository'
import { JsonTransformer } from '../../../../../utils'
import { Metadata } from '../../../../Metadata'
import * as testModule from '../did'

const agentConfig = getAgentConfig('Migration DidRecord 0.3-0.3.1')
const agentContext = getAgentContext()

jest.mock('../../../../../modules/dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>
const didRepository = new DidRepositoryMock()

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => didRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3-0.3.1 | Did', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateDidRecordToV0_3_1()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidRecord[] = [getDid({ id: 'did:peer:123' })]

      mockFunction(didRepository.getAll).mockResolvedValue(records)

      await testModule.migrateDidRecordToV0_3_1(agent)

      expect(didRepository.getAll).toHaveBeenCalledTimes(1)
      expect(didRepository.save).toHaveBeenCalledTimes(1)

      const [, didRecord] = mockFunction(didRepository.save).mock.calls[0]
      expect(didRecord).toMatchObject({
        type: 'DidRecord',
        id: expect.any(String),
        did: 'did:peer:123',
        metadata: expect.any(Metadata),
        role: DidDocumentRole.Created,
        _tags: {},
      })

      expect(didRepository.deleteById).toHaveBeenCalledTimes(1)
      expect(didRepository.deleteById).toHaveBeenCalledWith(expect.any(AgentContext), 'did:peer:123')
    })
  })
})

function getDid({ id }: { id: string }) {
  return JsonTransformer.fromJSON(
    {
      role: DidDocumentRole.Created,
      id,
    },
    DidRecord
  )
}
