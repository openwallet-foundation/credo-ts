import type { AgentContext } from '../../../agent/context/AgentContext'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { QueuedMessage } from '../../message-pickup'
import type { TrustPingMessage } from '../messages'

import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { InjectionSymbols } from '../../../constants'
import { MessagePickupSessionService } from '../../message-pickup/services/MessagePickupSessionService'
import { InMemoryMessagePickupRepository } from '../../message-pickup/storage/InMemoryMessagePickupRepository'
import { MediatorModuleConfig } from '../../routing/MediatorModuleConfig'
import { MessageForwardingStrategy } from '../../routing/MessageForwardingStrategy'
import { DidExchangeState } from '../models/DidExchangeState'
import { TrustPingService } from '../services/TrustPingService'

jest.useFakeTimers()

jest.mock('../../message-pickup/services/MessagePickupSessionService')
jest.mock('../../message-pickup/storage/InMemoryMessagePickupRepository')
jest.mock('../../../agent/MessageSender')

const MessagePickupSessionServiceMock = MessagePickupSessionService as jest.Mock<MessagePickupSessionService>
const messagePickupRepositoryMock = InMemoryMessagePickupRepository as jest.Mock<InMemoryMessagePickupRepository>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

const messagePickupSessionService = new MessagePickupSessionServiceMock()
const messagePickupRepository = new messagePickupRepositoryMock()
const messageSender = new MessageSenderMock()

const agentConfig = getAgentConfig('ConnectionServiceTest', {})

const createMockInboundMessage = (agentContext: AgentContext): InboundMessageContext<TrustPingMessage> => ({
  receivedAt: new Date(),
  agentContext,
  message: '' as unknown as TrustPingMessage,
  setMessageHandler: jest.fn(),
  setResponseMessage: jest.fn(),
  assertReadyConnection: jest.fn(),
  toJSON: jest.fn(),
})

const createMockConnectionRecord = (overrides = {}) =>
  getMockConnection({ state: DidExchangeState.RequestSent, id: 'test-id', theirDid: undefined, ...overrides })

describe('TrustPingService', () => {
  let trustPingService: TrustPingService
  let eventEmitter: EventEmitter

  beforeEach(() => {
    jest.clearAllMocks()
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    trustPingService = new TrustPingService(eventEmitter)
  })

  it('implicit pickup using trust ping creates live pickup session when live mode enabled and sends packages from queue', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [
          MediatorModuleConfig,
          new MediatorModuleConfig({
            messageForwardingStrategy: MessageForwardingStrategy.QueueAndLiveModeDelivery,
          }),
        ],
        [MessagePickupSessionService, messagePickupSessionService],
        [MessageSender, messageSender],
        [InjectionSymbols.MessagePickupRepository, messagePickupRepository],
      ],
    })

    const connectionRecord = getMockConnection({
      state: DidExchangeState.RequestSent,
      id: 'test-id',
      theirDid: undefined,
    })

    mockFunction(messagePickupSessionService.getLiveSessionByConnectionId).mockReturnValue(undefined)
    mockFunction(messagePickupRepository.takeFromQueue).mockResolvedValue([
      { encryptedMessage: { hello: 'world' } } as unknown as QueuedMessage,
      { encryptedMessage: { hello: 'world' } } as unknown as QueuedMessage,
      { encryptedMessage: { hello: 'world' } } as unknown as QueuedMessage,
    ] as never)

    trustPingService.processPing(createMockInboundMessage(agentContext), connectionRecord)

    // Fast-forward the setTimeout
    jest.runAllTimers()
    // Clean out the async sends in the timer
    await jest.runAllTimersAsync()

    // ✅ Assert the session was saved
    expect(messagePickupSessionService.saveLiveSession).toHaveBeenCalledWith(agentContext, {
      connectionId: connectionRecord.id,
      protocolVersion: 'v2',
      role: expect.any(String),
    })

    // ✅ Assert messages were pulled from the queue
    expect(messagePickupRepository.takeFromQueue).toHaveBeenCalledWith({
      connectionId: connectionRecord.id,
      limit: 10,
      deleteMessages: true,
    })
    expect(messageSender.sendPackage).toHaveBeenCalledTimes(3)
  })
  it('implicit pickup using trust ping does not create new pickup session if it already exists for connection', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [
          MediatorModuleConfig,
          new MediatorModuleConfig({
            messageForwardingStrategy: MessageForwardingStrategy.QueueAndLiveModeDelivery,
          }),
        ],
        [MessagePickupSessionService, messagePickupSessionService],
        [MessageSender, messageSender],
        [InjectionSymbols.MessagePickupRepository, messagePickupRepository],
      ],
    })

    const connectionRecord = createMockConnectionRecord()

    mockFunction(messagePickupSessionService.getLiveSessionByConnectionId).mockReturnValue({
      connectionId: connectionRecord.id,
      protocolVersion: 'v2',
      role: expect.any(String),
      id: 'test-id',
    })
    mockFunction(messagePickupRepository.takeFromQueue).mockResolvedValue([
      { encryptedMessage: { hello: 'world' } } as unknown as QueuedMessage,
    ] as never)

    trustPingService.processPing(createMockInboundMessage(agentContext), createMockConnectionRecord())

    // Fast-forward the setTimeout
    jest.runAllTimers()
    await Promise.resolve()

    // ✅ Assert the session was saved
    expect(messagePickupSessionService.saveLiveSession).not.toHaveBeenCalled()
  })
  it('implicit pickup using trust ping does not send packages if queue is empty', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [
          MediatorModuleConfig,
          new MediatorModuleConfig({
            messageForwardingStrategy: MessageForwardingStrategy.QueueAndLiveModeDelivery,
          }),
        ],
        [MessagePickupSessionService, messagePickupSessionService],
        [MessageSender, messageSender],
        [InjectionSymbols.MessagePickupRepository, messagePickupRepository],
      ],
    })

    const connectionRecord = createMockConnectionRecord()

    mockFunction(messagePickupSessionService.getLiveSessionByConnectionId).mockReturnValue(undefined)
    mockFunction(messagePickupRepository.takeFromQueue).mockResolvedValue([] as never)

    trustPingService.processPing(createMockInboundMessage(agentContext), connectionRecord)

    // Fast-forward the setTimeout
    jest.runAllTimers()
    await Promise.resolve()

    // ✅ Assert the session was saved
    expect(messagePickupSessionService.saveLiveSession).toHaveBeenCalled()
    expect(messageSender.sendPackage).not.toHaveBeenCalled()
  })
  it('does not create live session when not in live delivery mode', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [
          MediatorModuleConfig,
          new MediatorModuleConfig({
            messageForwardingStrategy: MessageForwardingStrategy.QueueOnly,
          }),
        ],
        [MessagePickupSessionService, messagePickupSessionService],
        [MessageSender, messageSender],
        [InjectionSymbols.MessagePickupRepository, messagePickupRepository],
      ],
    })

    const connectionRecord = createMockConnectionRecord()

    mockFunction(messagePickupSessionService.getLiveSessionByConnectionId).mockReturnValue(undefined)
    mockFunction(messagePickupRepository.takeFromQueue).mockResolvedValue([
      { encryptedMessage: { hello: 'world' } } as unknown as QueuedMessage,
    ] as never)

    trustPingService.processPing(createMockInboundMessage(agentContext), connectionRecord)

    // Fast-forward the setTimeout
    jest.runAllTimers()
    // Clean out the async sends in the timer
    await jest.runAllTimersAsync()

    // ✅ Assert the session was saved
    expect(messagePickupSessionService.saveLiveSession).not.toHaveBeenCalled()
  })
})
