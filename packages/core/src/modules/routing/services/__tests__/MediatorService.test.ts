import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { ConnectionService, DidExchangeState } from '../../../connections'
import { isDidKey } from '../../../dids/helpers'
import { MediatorModuleConfig } from '../../MediatorModuleConfig'
import { MediationRole, MediationState } from '../../models'
import { MediatorService } from '../../protocol/coordinate-mediation/v1/MediatorService'
import {
  KeylistUpdateAction,
  KeylistUpdateMessage,
  KeylistUpdateResult,
} from '../../protocol/coordinate-mediation/v1/messages'
import { MediationRecord, MediatorRoutingRecord } from '../../repository'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../repository/MediatorRoutingRepository'

import { MessageSender } from '@aries-framework/core'

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../repository/MediatorRoutingRepository')
const MediatorRoutingRepositoryMock = MediatorRoutingRepository as jest.Mock<MediatorRoutingRepository>

jest.mock('../../../connections/services/ConnectionService')
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>

jest.mock('../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

jest.mock('../../../../agent/MessageSender')
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

const mediationRepository = new MediationRepositoryMock()
const mediatorRoutingRepository = new MediatorRoutingRepositoryMock()
const connectionService = new ConnectionServiceMock()
const dispatcher = new DispatcherMock()
const messageSender = new MessageSenderMock()

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

describe('MediatorService - default config', () => {
  const agentConfig = getAgentConfig('MediatorService')

  const agentContext = getAgentContext({
    agentConfig,
  })

  const mediatorService = new MediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    messageSender,
    connectionService,
    dispatcher,
    new MediatorModuleConfig()
  )

  describe('createGrantMediationMessage', () => {
    test('sends base58 encoded recipient keys by default', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(
        new MediatorRoutingRecord({
          routingKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
        })
      )

      const { message } = await mediatorService.createGrantMediationMessage(agentContext, mediationRecord)

      expect(message.routingKeys.length).toBe(1)
      expect(isDidKey(message.routingKeys[0])).toBeFalsy()
    })
  })

  describe('processKeylistUpdateRequest', () => {
    test('processes base58 encoded recipient keys', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Granted,
        threadId: 'threadId',
        recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keyListUpdate = new KeylistUpdateMessage({
        updates: [
          {
            action: KeylistUpdateAction.add,
            recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          },
          {
            action: KeylistUpdateAction.remove,
            recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          },
        ],
      })

      const messageContext = new InboundMessageContext(keyListUpdate, { connection: mockConnection, agentContext })
      const response = await mediatorService.processKeylistUpdateRequest(messageContext)

      expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
      expect(response.updated).toEqual([
        {
          action: KeylistUpdateAction.add,
          recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          result: KeylistUpdateResult.Success,
        },
        {
          action: KeylistUpdateAction.remove,
          recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          result: KeylistUpdateResult.Success,
        },
      ])
    })
  })

  test('processes did:key encoded recipient keys', async () => {
    const mediationRecord = new MediationRecord({
      connectionId: 'connectionId',
      role: MediationRole.Mediator,
      state: MediationState.Granted,
      threadId: 'threadId',
      recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
    })

    mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

    const keyListUpdate = new KeylistUpdateMessage({
      updates: [
        {
          action: KeylistUpdateAction.add,
          recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        },
        {
          action: KeylistUpdateAction.remove,
          recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        },
      ],
    })

    const messageContext = new InboundMessageContext(keyListUpdate, { connection: mockConnection, agentContext })
    const response = await mediatorService.processKeylistUpdateRequest(messageContext)

    expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    expect(response.updated).toEqual([
      {
        action: KeylistUpdateAction.add,
        recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
        result: KeylistUpdateResult.Success,
      },
      {
        action: KeylistUpdateAction.remove,
        recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
        result: KeylistUpdateResult.Success,
      },
    ])
  })
})

describe('MediatorService - useDidKeyInProtocols set to true', () => {
  const agentConfig = getAgentConfig('MediatorService', { useDidKeyInProtocols: true })

  const agentContext = getAgentContext({
    agentConfig,
  })

  const mediatorService = new MediatorService(
    mediationRepository,
    mediatorRoutingRepository,
    new EventEmitter(agentConfig.agentDependencies, new Subject()),
    agentConfig.logger,
    messageSender,
    connectionService,
    dispatcher,
    new MediatorModuleConfig()
  )

  describe('createGrantMediationMessage', () => {
    test('sends did:key encoded recipient keys when config is set', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Requested,
        threadId: 'threadId',
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const routingRecord = new MediatorRoutingRecord({
        routingKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediatorRoutingRepository.findById).mockResolvedValue(routingRecord)

      const { message } = await mediatorService.createGrantMediationMessage(agentContext, mediationRecord)

      expect(message.routingKeys.length).toBe(1)
      expect(isDidKey(message.routingKeys[0])).toBeTruthy()
    })
  })
})
