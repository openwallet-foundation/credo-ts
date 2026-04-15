import type { Logger } from '@credo-ts/core'
import { Subject } from 'rxjs'
import type { MockedFunction } from 'vitest'
import type { MockedClassConstructor } from '../../../../../../tests/types'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../core/src/error/CredoError'
import { testLogger } from '../../../../../core/tests'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../../didcomm/src'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { InMemoryQueueTransportRepository } from '../../../transport/queue/InMemoryQueueTransportRepository'
import { DidCommDidExchangeState } from '../../connections/models/DidCommDidExchangeState'
import { DidCommConnectionService } from '../../connections/services/DidCommConnectionService'
import { DidCommMessagePickupApi } from '../DidCommMessagePickupApi'
import { DidCommMessagePickupModuleConfig } from '../DidCommMessagePickupModuleConfig'
import type { DidCommMessagePickupSession } from '../DidCommMessagePickupSession'
import {
  DidCommMessageDeliveryV2Message,
  DidCommMessagePickupV1Protocol,
  DidCommMessagePickupV2Protocol,
  DidCommMessagePickupV3Protocol,
} from '../protocol'
import type { DidCommMessagePickupProtocol } from '../protocol/DidCommMessagePickupProtocol'
import { DidCommMessageDeliveryV3Message } from '../protocol/v3'
import { DidCommMessagePickupSessionService } from '../services/DidCommMessagePickupSessionService'

const mockConnection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

vi.mock('../../../../../core/src/agent/EventEmitter')
vi.mock('../../../DidCommMessageSender')
vi.mock('../../connections/services/DidCommConnectionService')
vi.mock('../services/DidCommMessagePickupSessionService')
vi.mock('../../../transport/queue/InMemoryQueueTransportRepository')

const EventEmitterMock = EventEmitter as MockedClassConstructor<typeof EventEmitter>
const MessageSenderMock = DidCommMessageSender as MockedClassConstructor<typeof DidCommMessageSender>
const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>
const MessagePickupSessionServiceMock = DidCommMessagePickupSessionService as MockedClassConstructor<
  typeof DidCommMessagePickupSessionService
>

const messagePickupModuleConfig = new DidCommMessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [
    new DidCommMessagePickupV1Protocol(),
    new DidCommMessagePickupV2Protocol(),
    new DidCommMessagePickupV3Protocol(),
  ],
})

// Mock classes
const eventEmitter = new EventEmitterMock()
const messageSender = new MessageSenderMock()
const connectionService = new ConnectionServiceMock()
const messagePickupSessionService = new MessagePickupSessionServiceMock()

const queueTransportRepository = new (
  InMemoryQueueTransportRepository as MockedClassConstructor<typeof InMemoryQueueTransportRepository>
)()
const didCommModuleConfigWithQueue = new DidCommModuleConfig({ queueTransportRepository })

// Mock typed object
const agentContext = getAgentContext({
  registerInstances: [
    [EventEmitter, eventEmitter],
    [DidCommMessageSender, messageSender],
    [DidCommConnectionService, connectionService],
    [DidCommMessagePickupModuleConfig, messagePickupModuleConfig],
    [DidCommMessagePickupSessionService, messagePickupSessionService],
    [DidCommModuleConfig, didCommModuleConfigWithQueue],
  ],
})

describe('DidCommMessagePickupApi', () => {
  vi.resetAllMocks()

  let api: DidCommMessagePickupApi<DidCommMessagePickupProtocol[]>
  let mockLogger: Logger
  let stop$: Subject<boolean>

  beforeEach(() => {
    vi.resetAllMocks()
    stop$ = new Subject()
    mockLogger = testLogger
    api = new DidCommMessagePickupApi(
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
    } as DidCommMessagePickupSession)
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

    const sendMessageMock = messageSender.sendMessage as MockedFunction<(typeof messageSender)['sendMessage']>
    const [outboundCtx, options] = sendMessageMock.mock.calls[0]

    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
    expect(outboundCtx.message.type).toEqual(DidCommMessageDeliveryV2Message.type.messageTypeUri)
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

  it('sends v3 delivery message when session uses v3 protocol', async () => {
    const mockConnectionV3 = getMockConnection({
      state: DidCommDidExchangeState.Completed,
    })
    mockConnectionV3.didcommVersion = 'v2'
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      connectionId: mockConnectionV3.id,
      protocolVersion: 'v3',
    } as DidCommMessagePickupSession)
    mockFunction(connectionService.getById).mockResolvedValue(mockConnectionV3)
    mockFunction(queueTransportRepository.takeFromQueue).mockResolvedValue([
      {
        id: 'msg-1',
        encryptedMessage: { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' },
        receivedAt: new Date(),
      },
    ])

    await api.deliverMessagesFromQueue({
      pickupSessionId: 'pickup-1',
      recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      batchSize: 10,
    })

    const sendMessageMock = messageSender.sendMessage as MockedFunction<(typeof messageSender)['sendMessage']>
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const [outboundCtx] = sendMessageMock.mock.calls[0]
    expect(outboundCtx.message.type).toEqual(DidCommMessageDeliveryV3Message.type.messageTypeUri)
  })
})
