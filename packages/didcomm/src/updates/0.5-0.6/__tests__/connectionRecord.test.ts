import { Agent } from '@credo-ts/core/src/agent/Agent'
import { JsonTransformer } from '@credo-ts/core/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '@credo-ts/core/tests'
import { DidCommConnectionRecord } from '../../../modules/connections'
import { DidCommConnectionRepository } from '../../../modules/connections/repository/DidCommConnectionRepository'
import * as testModule from '../connectionRecord'

const agentConfig = getAgentConfig('Migration - Credential Exchange Record - 0.4-0.5')
const agentContext = getAgentContext()

jest.mock('../../../modules/connections/repository/DidCommConnectionRepository')
const ConnectionRepositoryMock = DidCommConnectionRepository as jest.Mock<DidCommConnectionRepository>
const connectionRepository = new ConnectionRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => ({
  Agent: jest.fn(() => ({
    config: agentConfig,
    context: agentContext,
    dependencyManager: {
      resolve: jest.fn(() => connectionRepository),
    },
  })),
}))

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.5-0.6 | Migration | DIDComm Connection Record', () => {
  let agent: Agent

  beforeAll(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateConnectionRecordToV0_6()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidCommConnectionRecord[] = [
        getConnectionRecord({ alias: 'alias-1', theirDid: 'theirDid-1' }),
        getConnectionRecord({}),
        getConnectionRecord({ alias: 'alias-3', theirDid: 'theirDid-3' }),
      ]

      mockFunction(connectionRepository.getAll).mockResolvedValue(records)

      await testModule.migrateConnectionRecordToV0_6(agent)

      expect(connectionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(connectionRepository.update).toHaveBeenCalledTimes(1)

      const [, connectionRecord] = mockFunction(connectionRepository.update).mock.calls[0]
      expect(connectionRecord.toJSON()).toMatchObject({
        tags: { alias: 'alias-1', theirDid: 'theirDid' },
      })
    })
  })

  function getConnectionRecord({
    id,
    metadata,
    alias,
    theirDid,
  }: {
    id?: string
    metadata?: Record<string, unknown>
    alias?: string
    theirDid?: string
  }) {
    return JsonTransformer.fromJSON(
      {
        id: id ?? 'connection-id',
        metadata,
        alias,
        theirDid,
      },
      DidCommConnectionRecord
    )
  }
})
