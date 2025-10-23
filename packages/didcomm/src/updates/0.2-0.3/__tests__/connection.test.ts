import type { MockedClassConstructor } from '../../../../../../tests/types'
import { Agent } from '../../../../..//core/src/agent/Agent'
import { JsonTransformer } from '../../../../../core/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests/helpers'
import type { DidCommMediationRecordProps } from '../../../modules'
import { DidCommMediationRecord, DidCommMediationRole, DidCommMediationState } from '../../../modules'
import type { CustomDidCommConnectionTags, DidCommConnectionRecordProps } from '../../../modules/connections'
import {
  DidCommConnectionRecord,
  DidCommConnectionType,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
} from '../../../modules/connections'
import { DidCommConnectionRepository } from '../../../modules/connections/repository/DidCommConnectionRepository'
import { DidCommMediationRepository } from '../../../modules/routing/repository/DidCommMediationRepository'
import * as testModule from '../connection'

const agentConfig = getAgentConfig('Migration DidCommConnectionRecord 0.2-0.3')
const agentContext = getAgentContext()

vi.mock('../../../modules/connections/repository/DidCommConnectionRepository')
const ConnectionRepositoryMock = DidCommConnectionRepository as MockedClassConstructor<
  typeof DidCommConnectionRepository
>
const connectionRepository = new ConnectionRepositoryMock()

vi.mock('../../../modules/routing/repository/DidCommMediationRepository')
const MediationRepositoryMock = DidCommMediationRepository as MockedClassConstructor<typeof DidCommMediationRepository>
const mediationRepository = new MediationRepositoryMock()

vi.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn((token) => (token === ConnectionRepositoryMock ? connectionRepository : mediationRepository)),
      },
    })),
  }
})

const AgentMock = Agent as MockedClassConstructor<typeof Agent>

describe('0.2-0.3 | Connection', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateConnectionRecordToV0_3', () => {
    it('should fetch all records and apply the needed updates', async () => {
      const connectionRecordsProps = [
        getConnection({
          state: DidCommDidExchangeState.Completed,
          role: DidCommDidExchangeRole.Responder,
          id: 'theConnectionId',
        }),
        getConnection({
          state: DidCommDidExchangeState.Completed,
          role: DidCommDidExchangeRole.Responder,
          id: 'theConnectionId2',
        }),
      ]

      const mediationRecordsProps = [
        getMediator({
          state: DidCommMediationState.Granted,
          role: DidCommMediationRole.Recipient,
          connectionId: 'theConnectionId',
          threadId: 'theThreadId',
        }),
      ]

      const connectionRecords: DidCommConnectionRecord[] = connectionRecordsProps

      mockFunction(connectionRepository.getAll).mockResolvedValue(connectionRecords)

      const mediationRecords: DidCommMediationRecord[] = mediationRecordsProps

      mockFunction(mediationRepository.getAll).mockResolvedValue(mediationRecords)

      await testModule.migrateConnectionRecordToV0_3(agent)

      expect(connectionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(mediationRepository.getAll).toHaveBeenCalledTimes(1)
      expect(connectionRepository.update).toHaveBeenCalledTimes(connectionRecords.length)
    })
  })

  describe('migrateConnectionRecordMediatorTags', () => {
    it('should set the mediator connection type on the record, connection type tags should be undefined', async () => {
      const connectionRecordProps = {
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Responder,
        id: 'theConnectionId',
      }

      const connectionRecord = getConnection(connectionRecordProps)

      await testModule.migrateConnectionRecordTags(agent, connectionRecord, new Set(['theConnectionId']))

      expect(connectionRecord.toJSON()).toEqual({
        ...connectionRecordProps,
        connectionTypes: [DidCommConnectionType.Mediator],
        _tags: {
          connectionType: undefined,
        },
        previousDids: [],
        previousTheirDids: [],
        metadata: {},
      })
    })

    it('should add the mediator connection type to existing types on the record, connection type tags should be undefined', async () => {
      const connectionRecordProps = {
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Responder,
        id: 'theConnectionId',
        _tags: {
          connectionType: ['theConnectionType'],
        },
      }

      const connectionRecord = getConnection(connectionRecordProps)

      await testModule.migrateConnectionRecordTags(agent, connectionRecord, new Set(['theConnectionId']))

      expect(connectionRecord.toJSON()).toEqual({
        ...connectionRecordProps,
        connectionTypes: ['theConnectionType', DidCommConnectionType.Mediator],
        _tags: {
          connectionType: undefined,
        },
        previousDids: [],
        previousTheirDids: [],
        metadata: {},
      })
    })

    it('should not set the mediator connection type on the record, connection type tags should be undefined', async () => {
      const connectionRecordProps = {
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Responder,
        id: 'theConnectionId',
      }

      const connectionRecord = getConnection(connectionRecordProps)

      await testModule.migrateConnectionRecordTags(agent, connectionRecord)

      expect(connectionRecord.toJSON()).toEqual({
        ...connectionRecordProps,
        connectionTypes: [],
        previousDids: [],
        previousTheirDids: [],
        _tags: {
          connectionType: undefined,
        },
        metadata: {},
      })
    })

    it('should not add the mediator connection type to existing types on the record, connection type tags should be undefined', async () => {
      const connectionRecordProps = {
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Responder,
        id: 'theConnectionId',
        _tags: {
          connectionType: ['theConnectionType'],
        },
      }

      const connectionRecord = getConnection(connectionRecordProps)

      await testModule.migrateConnectionRecordTags(agent, connectionRecord)

      expect(connectionRecord.toJSON()).toEqual({
        ...connectionRecordProps,
        connectionTypes: ['theConnectionType'],
        _tags: {
          connectionType: undefined,
        },
        metadata: {},
        previousDids: [],
        previousTheirDids: [],
      })
    })
  })
})

function getConnection({
  state,
  role,
  id,
  _tags,
}: DidCommConnectionRecordProps & { _tags?: CustomDidCommConnectionTags }) {
  return JsonTransformer.fromJSON({ state, role, id, _tags }, DidCommConnectionRecord)
}

function getMediator({ state, role, connectionId, threadId }: DidCommMediationRecordProps) {
  return JsonTransformer.fromJSON({ state, role, connectionId, threadId }, DidCommMediationRecord)
}
