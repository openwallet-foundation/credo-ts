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
        getConnectionRecord({ alias: 'alias-1', theirLabel: 'theirLabel-1' }),
        getConnectionRecord({}),
        getConnectionRecord({ alias: 'alias-3', theirLabel: 'theirLabel-3' }),
      ]

      mockFunction(connectionRepository.getAll).mockResolvedValue(records)

      await testModule.migrateConnectionRecordToV0_6(agent)

      expect(connectionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(connectionRepository.update).toHaveBeenCalledTimes(3)

      const [, connectionRecord1] = mockFunction(connectionRepository.update).mock.calls[0]
      expect(connectionRecord1.toJSON()).toMatchObject({
        _tags: expect.objectContaining({ alias: 'alias-1', theirLabel: 'theirLabel-1' }),
      })
      const [, connectionRecord2] = mockFunction(connectionRepository.update).mock.calls[1]
      expect(connectionRecord2.toJSON()).toMatchObject({
        _tags: expect.objectContaining({ alias: undefined, theirLabel: undefined }),
      })
      const [, connectionRecord3] = mockFunction(connectionRepository.update).mock.calls[2]
      expect(connectionRecord3.toJSON()).toMatchObject({
        _tags: expect.objectContaining({ alias: 'alias-3', theirLabel: 'theirLabel-3' }),
      })            
    })
  })

  function getConnectionRecord({
    id,
    metadata,
    alias,
    theirLabel,
  }: {
    id?: string
    metadata?: Record<string, unknown>
    alias?: string
    theirLabel?: string
  }) {
    return JsonTransformer.fromJSON(
      {
        id: id ?? 'connection-id',
        metadata,
        alias,
        theirLabel,
      },
      DidCommConnectionRecord
    )
  }
})
