import { Subject } from 'rxjs'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { testLogger } from '../../../../../core/tests'
import { getAgentConfig, getAgentContext, getMockConnection } from '../../../../../core/tests/helpers'
import { DummyTransportSession } from '../../../__tests__/stubs'
import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommTransportService } from '../../../DidCommTransportService'
import { MessageSendingError } from '../../../errors'
import type { DidCommOutboundMessageContext } from '../../../models'
import { DidCommDidExchangeState } from '../../connections/models/DidCommDidExchangeState'
import type { DidCommConnectionService } from '../../connections/services/DidCommConnectionService'
import { DidCommMessagePickupApi } from '../DidCommMessagePickupApi'
import { DidCommMessagePickupModuleConfig } from '../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionRole } from '../DidCommMessagePickupSession'
import { DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol } from '../protocol'
import { DidCommMessagePickupSessionService } from '../services/DidCommMessagePickupSessionService'

describe('DidCommMessagePickupApi live delivery', () => {
  const agentConfig = getAgentConfig('MessagePickupApiLiveDelivery')
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
  const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
  const recipientDid = 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
  const sendError = new MessageSendingError('Message is undeliverable', {
    outboundMessageContext: {} as DidCommOutboundMessageContext,
  })

  let sessionService: DidCommMessagePickupSessionService
  let transportService: DidCommTransportService
  let transportSession: DummyTransportSession
  let agentContext: ReturnType<typeof getAgentContext>
  let api: DidCommMessagePickupApi
  let messageSender: DidCommMessageSender

  const saveLiveSession = (transportSessionId: string) =>
    sessionService.saveLiveSession(agentContext, {
      connectionId: connection.id,
      protocolVersion: 'v2',
      role: DidCommMessagePickupSessionRole.MessageHolder,
      transportSessionId,
    })

  const liveTransportSessionId = () =>
    sessionService.getLiveSessionByConnectionId(agentContext, { connectionId: connection.id })?.transportSessionId

  beforeEach(() => {
    sessionService = new DidCommMessagePickupSessionService()
    transportService = new DidCommTransportService(getAgentContext(), eventEmitter)
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidCommModuleConfig, new DidCommModuleConfig()],
        [DidCommTransportService, transportService],
        [EventEmitter, eventEmitter],
      ],
    })
    transportSession = new DummyTransportSession('transportSessionId')
    vi.spyOn(transportSession, 'close').mockResolvedValue()
    transportService.saveSession(transportSession)

    const connectionService = {
      getById: vi.fn().mockResolvedValue(connection),
    } as unknown as DidCommConnectionService

    messageSender = {
      queueMessage: vi.fn().mockResolvedValue('messageId'),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as DidCommMessageSender

    api = new DidCommMessagePickupApi(
      messageSender,
      agentContext,
      connectionService,
      eventEmitter,
      sessionService,
      new DidCommMessagePickupModuleConfig({
        protocols: [new DidCommMessagePickupV1Protocol(), new DidCommMessagePickupV2Protocol()],
      }),
      new Subject(),
      testLogger
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('queues the message through the message sender', async () => {
    const message = { protected: 'base64url', iv: 'base64url', ciphertext: 'base64url', tag: 'base64url' }

    await expect(
      api.queueMessage({ connectionId: connection.id, recipientDids: [recipientDid], message })
    ).resolves.toEqual({ messageId: 'messageId' })
    expect(messageSender.queueMessage).toHaveBeenCalledWith(agentContext, {
      connectionId: connection.id,
      recipientDids: [recipientDid],
      payload: message,
    })
  })

  test('does not deliver without a live mode session', async () => {
    const deliverSpy = vi.spyOn(api, 'deliverMessagesFromQueue')

    await expect(api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id })).resolves.toBe(false)
    expect(deliverSpy).not.toHaveBeenCalled()
  })

  test('delivers the queued messages to the live mode session', async () => {
    saveLiveSession('transportSessionId')
    const deliverSpy = vi.spyOn(api, 'deliverMessagesFromQueue').mockResolvedValue(undefined)

    await expect(
      api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id, recipientDid, messageIds: ['messageId'] })
    ).resolves.toBe(true)
    expect(deliverSpy).toHaveBeenCalledWith({
      pickupSessionId: sessionService.getLiveSessionByConnectionId(agentContext, { connectionId: connection.id })?.id,
      recipientDid,
      messageIds: ['messageId'],
    })
  })

  test('delivers only the given messages on the transport session of the live mode session', async () => {
    saveLiveSession('transportSessionId')
    const createDeliverySpy = vi
      .spyOn(DidCommMessagePickupV2Protocol.prototype, 'createDeliveryMessage')
      .mockResolvedValue({ message: new DidCommMessage() })

    await api.deliverMessagesFromQueue({
      pickupSessionId: sessionService.getLiveSessionByConnectionId(agentContext, { connectionId: connection.id })
        ?.id as string,
      messageIds: ['messageId'],
    })

    expect(createDeliverySpy).toHaveBeenCalledWith(agentContext, expect.objectContaining({ messageIds: ['messageId'] }))
    expect(messageSender.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'transportSessionId' }),
      expect.anything()
    )
  })

  test('ends the live mode session and closes its transport when the delivery send fails', async () => {
    saveLiveSession('transportSessionId')
    vi.spyOn(api, 'deliverMessagesFromQueue').mockRejectedValue(sendError)

    await expect(api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id })).resolves.toBe(false)

    expect(transportSession.close).toHaveBeenCalledTimes(1)
    expect(liveTransportSessionId()).toBeUndefined()
  })

  test('ends the live mode session when closing the transport throws', async () => {
    saveLiveSession('transportSessionId')
    vi.spyOn(api, 'deliverMessagesFromQueue').mockRejectedValue(sendError)
    vi.spyOn(transportSession, 'close').mockRejectedValue(new Error('close failed'))

    await expect(api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id })).resolves.toBe(false)
    expect(liveTransportSessionId()).toBeUndefined()
  })

  test('keeps a live mode session that replaced the failed one', async () => {
    saveLiveSession('transportSessionId')
    vi.spyOn(api, 'deliverMessagesFromQueue').mockImplementation(async () => {
      saveLiveSession('newTransportSessionId')
      throw sendError
    })

    await api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id })

    expect(transportSession.close).not.toHaveBeenCalled()
    expect(liveTransportSessionId()).toBe('newTransportSessionId')
  })

  test('keeps the live mode session when delivery fails before sending', async () => {
    saveLiveSession('transportSessionId')
    vi.spyOn(api, 'deliverMessagesFromQueue').mockRejectedValue(new Error('storage unavailable'))

    await api.deliverQueuedMessagesToLiveSession({ connectionId: connection.id })

    expect(transportSession.close).not.toHaveBeenCalled()
    expect(liveTransportSessionId()).toBe('transportSessionId')
  })
})
