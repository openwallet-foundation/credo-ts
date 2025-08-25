/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EncryptedMessage } from '../../../../build/types'
import type { MessagePickupSession } from '../MessagePickupSession'
import type { MessagePickupProtocol } from '../protocol/MessagePickupProtocol'

import { Subject } from 'rxjs'

import { getAgentContext, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { InjectionSymbols } from '../../../constants'
import { CredoError } from '../../../error/CredoError'
import { DidExchangeState } from '../../connections/models/DidExchangeState'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { MessagePickupApi } from '../MessagePickupApi'
import { MessagePickupModuleConfig } from '../MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessageDeliveryMessage, V2MessagePickupProtocol } from '../protocol'
import { MessagePickupSessionService } from '../services/MessagePickupSessionService'
import { InMemoryMessagePickupRepository } from '../storage/InMemoryMessagePickupRepository'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

jest.mock('../storage/InMemoryMessagePickupRepository')
jest.mock('../../../agent/EventEmitter')
jest.mock('../../../agent/MessageSender')
jest.mock('../../connections/services/ConnectionService')
jest.mock('../services/MessagePickupSessionService')

const InMessageRepositoryMock = InMemoryMessagePickupRepository as jest.Mock<InMemoryMessagePickupRepository>
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const MessagePickupSessionServiceMock = MessagePickupSessionService as jest.Mock<MessagePickupSessionService>

const messagePickupModuleConfig = new MessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [new V1MessagePickupProtocol(), new V2MessagePickupProtocol()],
})

// Mock classes
const messagePickupRepository = new InMessageRepositoryMock()
const eventEmitter = new EventEmitterMock()
const messageSender = new MessageSenderMock()
const connectionService = new ConnectionServiceMock()
const messagePickupSessionService = new MessagePickupSessionServiceMock()

// Mock typed object
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.MessagePickupRepository, messagePickupRepository],
    [EventEmitter, eventEmitter],
    [MessageSender, messageSender],
    [ConnectionService, connectionService],
    [MessagePickupModuleConfig, messagePickupModuleConfig],
    [MessagePickupSessionService, messagePickupSessionService],
  ],
})

const encryptedMessage: EncryptedMessage = {
  protected: 'base64url',
  iv: 'base64url',
  ciphertext: 'base64url',
  tag: 'base64url',
}

const queuedMessages = [
  { id: '1', encryptedMessage },
  { id: '2', encryptedMessage },
  { id: '3', encryptedMessage },
]

describe('MessagePickupApi', () => {
  jest.resetAllMocks()

  let api: MessagePickupApi<MessagePickupProtocol[]>
  let mockLogger: any
  let stop$: Subject<boolean>

  beforeEach(() => {
    jest.resetAllMocks()
    mockLogger = { debug: jest.fn() }
    stop$ = new Subject()

    api = new MessagePickupApi(
      messageSender,
      agentContext,
      connectionService,
      eventEmitter,
      messagePickupSessionService,
      messagePickupModuleConfig,
      stop$,
      mockLogger
    )
  })

  it('throws if deliverMessages has no active session', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue(undefined)

    await expect(api.deliverMessages({ pickupSessionId: 'bad', messages: [] })).rejects.toThrow(CredoError)

    expect(connectionService.getById).not.toHaveBeenCalled()
    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })

  it('sends delivery message if session is found with ws priority', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      connectionId: mockConnection.id,
      protocolVersion: 'v2',
    } as MessagePickupSession)
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)

    await api.deliverMessages({
      pickupSessionId: 'pickup-1',
      messages: [
        {
          id: 'abc',
          encryptedMessage: {
            protected: 'mock-protected',
            iv: 'mock-iv',
            ciphertext: 'mock-ciphertext',
            tag: 'mock-tag',
          },
        },
      ],
    })

    const sendMessageMock = messageSender.sendMessage as jest.Mock
    const [outboundCtx, options] = sendMessageMock.mock.calls[0]

    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
    expect(outboundCtx.message.type).toEqual(V2MessageDeliveryMessage.type.messageTypeUri)
    expect(outboundCtx.connection).toEqual(mockConnection)
    expect(options).toEqual({
      transportPriority: { schemes: ['wss', 'ws'], restrictive: true },
    })
  })

  it('throws if no active session is found', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue(undefined)

    await expect(
      api.deliverMessagesFromQueue({
        pickupSessionId: 'pickup-1',
        recipientDid: 'did:key:z6MkjFake',
        batchSize: 10,
      })
    ).rejects.toThrow(CredoError)
  })

  it('sends delivery message via websocket transport when session is found', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      id: 'pickup-1',
      connectionId: mockConnection.id,
      protocolVersion: 'v2',
    } as MessagePickupSession)
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)
    mockFunction(messagePickupRepository.takeFromQueue).mockReturnValue(queuedMessages)

    await api.deliverMessagesFromQueue({
      pickupSessionId: 'pickup-1',
      recipientDid: 'did:key:z6MkjFake',
      batchSize: 5,
    })

    const sendMessageMock = messageSender.sendMessage as jest.Mock
    const [outboundCtx, options] = sendMessageMock.mock.calls[0]

    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
    expect(outboundCtx.message.type).toEqual(V2MessageDeliveryMessage.type.messageTypeUri)
    expect(outboundCtx.connection).toEqual(mockConnection)
    expect(options).toEqual({
      transportPriority: { schemes: ['wss', 'ws'], restrictive: true },
    })
  })

  it('does not send message if the session does not exist', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      id: 'pickup-0', // Different session id
      connectionId: mockConnection.id,
      protocolVersion: 'v2',
    } as MessagePickupSession)
    mockFunction(messagePickupRepository.takeFromQueue).mockReturnValue([])
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)

    await api.deliverMessagesFromQueue({
      pickupSessionId: 'pickup-1',
      recipientDid: 'did:key:z6MkjFake',
      batchSize: 2,
    })

    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })
})
