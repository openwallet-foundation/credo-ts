import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import { DidDocumentRole, DidRecord } from '../../../../../modules/dids'
import { DidRepository } from '../../../../../modules/dids/repository/DidRepository'
import { JsonTransformer } from '../../../../../utils'
import { uuid } from '../../../../../utils/uuid'
import { Metadata } from '../../../../Metadata'
import * as testModule from '../did'

const agentConfig = getAgentConfig('Migration DidRecord 0.3.1-0.4')
const agentContext = getAgentContext()

jest.mock('../../../../../modules/dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>
const didRepository = new DidRepositoryMock()

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: jest.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: jest.fn(() => didRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3.1-0.4 | Did', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateDidRecordToV0_4()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidRecord[] = [getDid({ did: 'did:sov:123', qualifiedIndyDid: 'did:indy:local:123' })]

      mockFunction(didRepository.findByQuery).mockResolvedValue(records)

      await testModule.migrateDidRecordToV0_4(agent)

      expect(didRepository.findByQuery).toHaveBeenCalledTimes(1)
      expect(didRepository.findByQuery).toHaveBeenCalledWith(agent.context, {
        method: 'sov',
        role: DidDocumentRole.Created,
      })
      expect(didRepository.findByQuery).toHaveBeenCalledTimes(1)

      const [, didRecord] = mockFunction(didRepository.update).mock.calls[0]
      expect(didRecord).toMatchObject({
        type: 'DidRecord',
        id: expect.any(String),
        did: 'did:indy:local:123',
        metadata: expect.any(Metadata),
        role: DidDocumentRole.Created,
        _tags: {
          qualifiedIndyDid: undefined,
        },
      })
    })
  })
})

function getDid({ did, qualifiedIndyDid }: { did: string; qualifiedIndyDid: string }) {
  return JsonTransformer.fromJSON(
    {
      role: DidDocumentRole.Created,
      id: uuid(),
      did,
      _tags: {
        qualifiedIndyDid,
      },
    },
    DidRecord
  )
}
