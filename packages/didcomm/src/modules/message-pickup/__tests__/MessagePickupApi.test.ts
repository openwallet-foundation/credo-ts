import type { BaseEvent, Logger } from '@credo-ts/core'
import { Subject } from 'rxjs'
import type { MockedFunction } from 'vitest'
import type { MockedClassConstructor } from '../../../../../../tests/types'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../core/src/error/CredoError'
import { testLogger } from '../../../../../core/tests'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../../didcomm/src'
import { DidCommEventTypes } from '../../../DidCommEvents'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import type { DidCommOutboundMessageContext } from '../../../models'
import { InMemoryQueueTransportRepository } from '../../../transport/queue/InMemoryQueueTransportRepository'
import { DidCommDidExchangeState } from '../../connections/models/DidCommDidExchangeState'
import { DidCommConnectionService } from '../../connections/services/DidCommConnectionService'
import { DidCommMessagePickupApi } from '../DidCommMessagePickupApi'
import { DidCommMessagePickupEventTypes } from '../DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from '../DidCommMessagePickupModuleConfig'
import type { DidCommMessagePickupSession } from '../DidCommMessagePickupSession'
import {
  DidCommMessageDeliveryV2Message,
  DidCommMessagePickupV1Protocol,
  DidCommMessagePickupV2Protocol,
  DidCommMessagePickupV4Protocol,
  DidCommStatusV2Message,
} from '../protocol'
import type { DidCommMessagePickupProtocol } from '../protocol/DidCommMessagePickupProtocol'
import { DidCommMessageDeliveryV4Message, DidCommStatusV4Message } from '../protocol/v4'
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
    new DidCommMessagePickupV4Protocol(),
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

  it('sends v4 delivery message when session uses v4 protocol', async () => {
    const mockConnectionV3 = getMockConnection({
      state: DidCommDidExchangeState.Completed,
    })
    mockConnectionV3.didcommVersion = 'v2'
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      connectionId: mockConnectionV3.id,
      protocolVersion: 'v4',
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
    expect(outboundCtx.message.type).toEqual(DidCommMessageDeliveryV4Message.type.messageTypeUri)
  })

  it('pickupMessages only completes on the completed event of its own thread', async () => {
    const completed$ = new Subject<BaseEvent>()
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)
    mockFunction(eventEmitter.observable).mockReturnValue(completed$)

    function completeOnThread(threadId?: string): void {
      mockFunction(messageSender.sendMessage).mockImplementation(async (outboundMessageContext) => {
        const { message } = outboundMessageContext as DidCommOutboundMessageContext
        completed$.next({
          type: DidCommMessagePickupEventTypes.MessagePickupCompleted,
          metadata: { contextCorrelationId: agentContext.contextCorrelationId },
          payload: { connection: mockConnection, threadId: threadId ?? message.threadId },
        })
      })
    }
    const pickup = (): Promise<void> =>
      api.pickupMessages({
        connectionId: mockConnection.id,
        protocolVersion: 'v2',
        awaitCompletion: true,
        awaitCompletionTimeoutMs: 50,
      })

    completeOnThread('another-thread')
    await expect(pickup()).rejects.toThrow('Timeout has occurred')

    completeOnThread()
    await expect(pickup()).resolves.toBeUndefined()
  })

  describe('setLiveDeliveryMode with awaitConfirmation', () => {
    const processed$ = new Subject<BaseEvent>()

    function replyToLiveDeliveryChange(
      liveDelivery: boolean,
      Status: typeof DidCommStatusV2Message | typeof DidCommStatusV4Message = DidCommStatusV2Message
    ): void {
      mockFunction(messageSender.sendMessage).mockImplementation(async (outboundMessageContext) => {
        const { message } = outboundMessageContext as DidCommOutboundMessageContext
        processed$.next({
          type: DidCommEventTypes.DidCommMessageProcessed,
          metadata: { contextCorrelationId: agentContext.contextCorrelationId },
          payload: {
            message: new Status({ threadId: message.threadId, messageCount: 0, liveDelivery }),
            connection: mockConnection,
          },
        })
      })
    }

    beforeEach(() => {
      mockFunction(connectionService.getById).mockResolvedValue(mockConnection)
      mockFunction(eventEmitter.observable).mockReturnValue(processed$)
    })

    it('resolves once the threaded status reply confirms live delivery', async () => {
      replyToLiveDeliveryChange(true)

      await expect(
        api.setLiveDeliveryMode({
          connectionId: mockConnection.id,
          protocolVersion: 'v2',
          liveDelivery: true,
          awaitConfirmation: true,
        })
      ).resolves.toBeUndefined()
    })

    it('resolves once a pickup 4.0 status reply confirms live delivery', async () => {
      const mockConnectionV2 = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion: 'v2' })
      mockFunction(connectionService.getById).mockResolvedValue(mockConnectionV2)
      replyToLiveDeliveryChange(true, DidCommStatusV4Message)

      await expect(
        api.setLiveDeliveryMode({
          connectionId: mockConnectionV2.id,
          protocolVersion: 'v4',
          liveDelivery: true,
          awaitConfirmation: true,
        })
      ).resolves.toBeUndefined()
    })

    it('rejects when the mediator refuses live delivery or does not reply in time', async () => {
      replyToLiveDeliveryChange(false)
      await expect(
        api.setLiveDeliveryMode({
          connectionId: mockConnection.id,
          protocolVersion: 'v2',
          liveDelivery: true,
          awaitConfirmation: true,
        })
      ).rejects.toThrow(CredoError)

      mockFunction(messageSender.sendMessage).mockResolvedValue(undefined)
      await expect(
        api.setLiveDeliveryMode({
          connectionId: mockConnection.id,
          protocolVersion: 'v2',
          liveDelivery: true,
          awaitConfirmation: true,
          awaitConfirmationTimeoutMs: 50,
        })
      ).rejects.toThrow('Timeout has occurred')
    })
  })
})
