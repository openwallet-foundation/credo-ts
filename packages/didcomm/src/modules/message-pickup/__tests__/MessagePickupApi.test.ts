/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessagePickupSession } from '../MessagePickupSession'
import type { MessagePickupProtocol } from '../protocol/MessagePickupProtocol'

import { Subject } from 'rxjs'

import { Logger } from '@credo-ts/core'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../core/src/error/CredoError'
import { testLogger } from '../../../../../core/tests'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../../didcomm'
import { MessageSender } from '../../../MessageSender'
import { DidExchangeState } from '../../connections/models/DidExchangeState'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { MessagePickupApi } from '../MessagePickupApi'
import { MessagePickupModuleConfig } from '../MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessageDeliveryMessage, V2MessagePickupProtocol } from '../protocol'
import { MessagePickupSessionService } from '../services/MessagePickupSessionService'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

jest.mock('../../../../../core/src/agent/EventEmitter')
jest.mock('../../../MessageSender')
jest.mock('../../connections/services/ConnectionService')
jest.mock('../services/MessagePickupSessionService')

const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const MessagePickupSessionServiceMock = MessagePickupSessionService as jest.Mock<MessagePickupSessionService>

const messagePickupModuleConfig = new MessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [new V1MessagePickupProtocol(), new V2MessagePickupProtocol()],
})

// Mock classes
const eventEmitter = new EventEmitterMock()
const messageSender = new MessageSenderMock()
const connectionService = new ConnectionServiceMock()
const messagePickupSessionService = new MessagePickupSessionServiceMock()

// Mock typed object
const agentContext = getAgentContext({
  registerInstances: [
    [EventEmitter, eventEmitter],
    [MessageSender, messageSender],
    [ConnectionService, connectionService],
    [MessagePickupModuleConfig, messagePickupModuleConfig],
    [MessagePickupSessionService, messagePickupSessionService],
    [DidCommModuleConfig, new DidCommModuleConfig()],
  ],
})

describe('MessagePickupApi', () => {
  jest.resetAllMocks()

  let api: MessagePickupApi<MessagePickupProtocol[]>
  let mockLogger: Logger
  let stop$: Subject<boolean>

  beforeEach(() => {
    jest.resetAllMocks()
    stop$ = new Subject()
    mockLogger = testLogger
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
          receivedAt: new Date(),
        },
      ],
    })

    const sendMessageMock = messageSender.sendMessage as jest.Mock
    const [outboundCtx, options] = sendMessageMock.mock.calls[0]

    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
    expect(outboundCtx.message.type).toEqual(V2MessageDeliveryMessage.type.messageTypeUri)
    expect(outboundCtx.connection).toEqual(mockConnection)
    expect(options).toEqual({
      transportPriority: { schemes: ['wss', 'ws'] },
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
})
