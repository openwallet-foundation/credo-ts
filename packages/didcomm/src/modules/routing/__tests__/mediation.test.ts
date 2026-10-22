import { Subject, TimeoutError } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import type { AgentDependencies } from '../../../../../core/src/agent/AgentDependencies'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import type { InitConfig } from '../../../../../core/src/types'
import { sleep } from '../../../../../core/src/utils/sleep'
import { setupEventReplaySubjects } from '../../../../../core/tests/events'
import {
  getAgentConfig,
  getAgentContext,
  getAgentOptions,
  getMockConnection,
  waitForBasicMessageSubject,
} from '../../../../../core/tests/helpers'
import { DidCommEventTypes, type DidCommMessageProcessedEvent } from '../../../DidCommEvents'
import { DidCommModule } from '../../../DidCommModule'
import { DidCommModuleConfig, type DidCommModuleConfigOptions } from '../../../DidCommModuleConfig'
import { MessageSendingError } from '../../../errors'
import type { DidCommOutboundMessageContext } from '../../../models'
import { type DidCommOutboundWebSocketClosedEvent, DidCommTransportEventTypes } from '../../../transport'
import { DidCommBasicMessageEventTypes } from '../../basic-messages'
import { DidCommConnectionRecord, DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../connections'
import type { SetLiveDeliveryModeOptions } from '../../message-pickup/DidCommMessagePickupApiOptions'
import { DidCommStatusRequestV2Message, DidCommStatusV2Message } from '../../message-pickup/protocol/v2'
import { DidCommMessagePickupSessionService } from '../../message-pickup/services/DidCommMessagePickupSessionService'
import { DidCommMediationRecipientApi } from '../DidCommMediationRecipientApi'
import {
  DidCommMediationRecipientModuleConfig,
  type DidCommMediationRecipientModuleConfigOptions,
} from '../DidCommMediationRecipientModuleConfig'
import { DidCommMediatorPickupStrategy } from '../DidCommMediatorPickupStrategy'
import { DidCommMediationRole } from '../models/DidCommMediationRole'
import { DidCommMediationState } from '../models/DidCommMediationState'
import { DidCommMediationRecord } from '../repository'

const getRecipientAgentOptions = (
  useDidKeyInProtocols = true,
  inMemory = true,
  didCommModuleConfig: DidCommModuleConfigOptions = {}
) =>
  getAgentOptions(
    'Mediation: Recipient',
    {
      mediationRecipient: {
        mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
      },
      useDidKeyInProtocols,
      ...didCommModuleConfig,
    },
    undefined,
    undefined,
    { requireDidcomm: true, inMemory }
  )
const getMediatorAgentOptions = (useDidKeyInProtocols = true) =>
  getAgentOptions(
    'Mediation: Mediator',
    {
      endpoints: ['rxjs:mediator'],
      useDidKeyInProtocols,
      mediator: { autoAcceptMediationRequests: true },
    },
    {},
    {},
    { requireDidcomm: true }
  )

const senderAgentOptions = () =>
  getAgentOptions(
    'Mediation: Sender',
    {
      endpoints: ['rxjs:sender'],
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )

describe('mediator establishment', () => {
  let recipientAgent: Agent<ReturnType<typeof getRecipientAgentOptions>['modules']>
  let mediatorAgent: Agent<ReturnType<typeof getMediatorAgentOptions>['modules']>
  let senderAgent: Agent<ReturnType<typeof senderAgentOptions>['modules']>

  afterEach(async () => {
    await recipientAgent?.shutdown()
    await mediatorAgent?.shutdown()
    await senderAgent?.shutdown()
  })

  const e2eMediationTest = async (
    mediatorAgentOptions: {
      readonly config: InitConfig
      readonly dependencies: AgentDependencies
      modules: ReturnType<typeof getMediatorAgentOptions>['modules']
    },
    recipientAgentOptions: {
      config: InitConfig
      dependencies: AgentDependencies
      modules: ReturnType<typeof getRecipientAgentOptions>['modules']
    }
  ) => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const recipientMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Initialize mediatorReceived message
    mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Initialize recipient with mediation connections invitation
    recipientAgent = new Agent({
      ...recipientAgentOptions,

      modules: {
        ...recipientAgentOptions.modules,
        didcomm: new DidCommModule({
          // @ts-expect-error
          ...recipientAgentOptions.modules.didcomm.config.options,
          transports: {
            inbound: [new SubjectInboundTransport(recipientMessages)],
            outbound: [new SubjectOutboundTransport(subjectMap)],
          },
          mediationRecipient: {
            mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
            mediatorInvitationUrl: mediatorOutOfBandRecord.outOfBandInvitation.toUrl({
              domain: 'https://example.com/ssi',
            }),
          },
        }),
      },
    })
    await recipientAgent.initialize()
    const [recipientReplay] = setupEventReplaySubjects(
      [recipientAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    const recipientMediator = await recipientAgent.didcomm.mediationRecipient.findDefaultMediator()
    if (!recipientMediator) {
      throw new Error('expected recipientMediator')
    }
    const recipientMediatorConnection = await recipientAgent.didcomm.connections.getById(recipientMediator.connectionId)

    expect(recipientMediatorConnection).toBeInstanceOf(DidCommConnectionRecord)
    expect(recipientMediatorConnection?.isReady).toBe(true)

    const [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )
    expect(mediatorRecipientConnection?.isReady).toBe(true)

    expect(mediatorRecipientConnection).toBeConnectedWith(recipientMediatorConnection)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection!)

    expect(recipientMediator?.state).toBe(DidCommMediationState.Granted)

    // Initialize sender agent
    senderAgent = new Agent(senderAgentOptions())
    senderAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    const recipientOutOfBandRecord = await recipientAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const recipientInvitation = recipientOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: senderRecipientConnection } = await senderAgent.didcomm.oob.receiveInvitationFromUrl(
      recipientInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'senderAgent' }
    )

    if (!senderRecipientConnection) {
      throw new Error('expected senderRecipientConnection')
    }
    senderRecipientConnection = await senderAgent.didcomm.connections.returnWhenIsConnected(
      senderRecipientConnection.id
    )

    let [recipientSenderConnection] = await recipientAgent.didcomm.connections.findAllByOutOfBandId(
      recipientOutOfBandRecord.id
    )
    expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    expect(senderRecipientConnection).toBeConnectedWith(recipientSenderConnection!)
    expect(recipientSenderConnection?.isReady).toBe(true)
    expect(senderRecipientConnection.isReady).toBe(true)

    recipientSenderConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      recipientSenderConnection?.id
    )

    const message = 'hello, world'
    const { threadId } = await senderAgent.didcomm.basicMessages.sendMessage(senderRecipientConnection.id, message)

    const basicMessage = await waitForBasicMessageSubject(recipientReplay, {
      threadId,
      content: message,
    })

    // polling interval is 100ms, so 500ms should be enough to make sure no messages are sent
    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()
    await sleep(500)

    expect(basicMessage.content).toBe(message)
  }

  test(`Mediation end-to-end flow
        1. Start mediator agent and create invitation
        2. Start recipient agent with mediatorConnectionsInvite from mediator
        3. Assert mediator and recipient are connected and mediation state is Granted
        4. Start sender agent and create connection with recipient
        5. Assert endpoint in recipient invitation for sender is mediator endpoint
        6. Send basic message from sender to recipient and assert it is received on the recipient side
`, async () => {
    await e2eMediationTest(getMediatorAgentOptions(), getRecipientAgentOptions())
  })

  test('Mediation end-to-end flow (not using did:key)', async () => {
    await e2eMediationTest(getMediatorAgentOptions(false), getRecipientAgentOptions(false))
  })

  test('restart recipient agent and create connection through mediator after recipient agent is restarted', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const recipientMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Initialize mediator
    mediatorAgent = new Agent(getMediatorAgentOptions())
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    const recipientAgentOptions = getRecipientAgentOptions(undefined, false, {
      transports: {
        inbound: [new SubjectInboundTransport(recipientMessages)],
        outbound: [new SubjectOutboundTransport(subjectMap)],
      },
      mediationRecipient: {
        mediatorInvitationUrl: mediatorOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com/ssi',
        }),
        mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
      },
    })
    // Initialize recipient with mediation connections invitation
    recipientAgent = new Agent(recipientAgentOptions)
    await recipientAgent.initialize()

    const recipientMediator = await recipientAgent.didcomm.mediationRecipient.findDefaultMediator()
    if (!recipientMediator) {
      throw new Error('expected recipientMediator')
    }

    const recipientMediatorConnection = await recipientAgent.didcomm.connections.getById(recipientMediator.connectionId)
    expect(recipientMediatorConnection.isReady).toBe(true)

    const [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )
    expect(mediatorRecipientConnection.isReady).toBe(true)
    expect(mediatorRecipientConnection).toBeConnectedWith(recipientMediatorConnection)
    expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection)
    expect(recipientMediator.state).toBe(DidCommMediationState.Granted)

    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()

    // Restart recipient agent
    await recipientAgent.shutdown()
    await recipientAgent.initialize()
    const [recipientReplay] = setupEventReplaySubjects(
      [recipientAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    // Initialize sender agent
    senderAgent = new Agent(senderAgentOptions())
    senderAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    const recipientOutOfBandRecord = await recipientAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const recipientInvitation = recipientOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: senderRecipientConnection } = await senderAgent.didcomm.oob.receiveInvitationFromUrl(
      recipientInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'alice' }
    )

    if (!senderRecipientConnection) {
      throw new Error('expected senderRecipientConnection')
    }
    senderRecipientConnection = await senderAgent.didcomm.connections.returnWhenIsConnected(
      senderRecipientConnection.id
    )
    const [recipientSenderConnection] = await recipientAgent.didcomm.connections.findAllByOutOfBandId(
      recipientOutOfBandRecord.id
    )
    expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    expect(senderRecipientConnection).toBeConnectedWith(recipientSenderConnection!)

    expect(recipientSenderConnection?.isReady).toBe(true)
    expect(senderRecipientConnection.isReady).toBe(true)

    const message = 'hello, world'
    const { threadId } = await senderAgent.didcomm.basicMessages.sendMessage(senderRecipientConnection.id, message)

    const basicMessage = await waitForBasicMessageSubject(recipientReplay, {
      threadId,
      content: message,
    })

    expect(basicMessage.content).toBe(message)

    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()
  })
})

describe('DidCommMediationRecipientApi live mode', () => {
  const agentConfig = getAgentConfig('Mediation: Live Mode Recipient')
  const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
  const mediationRecord = new DidCommMediationRecord({
    connectionId: connection.id,
    role: DidCommMediationRole.Recipient,
    state: DidCommMediationState.Granted,
    threadId: 'threadId',
  })
  const outboundTransport = {
    supportedSchemes: ['ws'],
    sendMessage: vi.fn(),
    closeSocketByConnectionId: vi.fn(() => true),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig({ transports: { outbound: [outboundTransport] } })],
      [DidCommMessagePickupSessionService, new DidCommMessagePickupSessionService()],
    ],
  })
  const stop$ = new Subject<boolean>()
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, stop$)
  const messagePickupApi = {
    pickupMessages: vi.fn(async () => {}),
    setLiveDeliveryMode: vi.fn(async (_options: SetLiveDeliveryModeOptions) => {}),
  }
  const messageSender = { sendMessage: vi.fn() }

  function liveModeRecipient(config: DidCommMediationRecipientModuleConfigOptions): DidCommMediationRecipientApi {
    return new DidCommMediationRecipientApi(
      {} as never,
      { getById: async () => connection } as never,
      {} as never,
      messageSender as never,
      eventEmitter,
      {} as never,
      messagePickupApi as never,
      {} as never,
      {} as never,
      agentConfig.logger,
      agentContext,
      stop$,
      new DidCommMediationRecipientModuleConfig(config)
    )
  }

  function emitSocketClosed(): void {
    eventEmitter.emit<DidCommOutboundWebSocketClosedEvent>(agentContext, {
      type: DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent,
      payload: { socketId: 'socket', connectionId: connection.id },
    })
  }

  function replyToStatusRequests(status: { messageCount: number; liveDelivery?: boolean }): void {
    messageSender.sendMessage.mockImplementation(async ({ message }: DidCommOutboundMessageContext) => {
      eventEmitter.emit<DidCommMessageProcessedEvent>(agentContext, {
        type: DidCommEventTypes.DidCommMessageProcessed,
        payload: {
          message: new DidCommStatusV2Message({ threadId: message.threadId, ...status }),
          connection,
          handled: true,
        },
      })
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    stop$.next(true)
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetAllMocks()
  })

  test('waits for the mediator to confirm live mode for the check interval, capped at 10 seconds', async () => {
    for (const config of [{}, { liveModeCheckIntervalMs: 1000 }]) {
      await liveModeRecipient(config).initiateMessagePickup(
        mediationRecord,
        DidCommMediatorPickupStrategy.PickUpV2LiveMode
      )
    }

    expect(
      messagePickupApi.setLiveDeliveryMode.mock.calls.map(([options]) => [
        options.awaitConfirmation,
        options.awaitConfirmationTimeoutMs,
      ])
    ).toEqual([
      [true, 10000],
      [true, 1000],
    ])
  })

  test('does not check live mode or wait for confirmation when liveModeCheckIntervalMs is 0', async () => {
    await liveModeRecipient({ liveModeCheckIntervalMs: 0 }).initiateMessagePickup(
      mediationRecord,
      DidCommMediatorPickupStrategy.PickUpV2LiveMode
    )
    await vi.advanceTimersByTimeAsync(60000)

    expect(messagePickupApi.setLiveDeliveryMode).toHaveBeenCalledWith(
      expect.objectContaining({ awaitConfirmation: false })
    )
    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })

  test('does not start the live mode check when pickup stops while live mode is being set', async () => {
    const recipient = liveModeRecipient({ liveModeCheckIntervalMs: 100 })
    messagePickupApi.setLiveDeliveryMode.mockImplementation(() => recipient.stopMessagePickup())

    await recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    await vi.advanceTimersByTimeAsync(500)

    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })

  test('jitters the reconnect delay once the backoff reaches the cap', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await liveModeRecipient({
      baseMediatorReconnectionIntervalMs: 1000,
      maximumMediatorReconnectionIntervalMs: 1000,
    }).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)

    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(749)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(2)
  })

  test('drops a pending reconnect when pickup stops', async () => {
    const recipient = liveModeRecipient({})
    await recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)

    emitSocketClosed()
    await recipient.stopMessagePickup()
    await vi.advanceTimersByTimeAsync(30000)

    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(1)
  })

  test('resets the reconnect backoff only once a live mode check passes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    replyToStatusRequests({ messageCount: 0, liveDelivery: true })
    await liveModeRecipient({
      baseMediatorReconnectionIntervalMs: 1000,
      liveModeCheckIntervalMs: 100,
    }).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)

    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(1000)
    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(1999)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(100)
    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(1000)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(4)
  })

  test('closes the mediator socket when live mode setup fails to send, and rethrows local errors', async () => {
    const recipient = liveModeRecipient({})
    messagePickupApi.setLiveDeliveryMode.mockRejectedValueOnce(
      new MessageSendingError('Socket is not open', { outboundMessageContext: {} as DidCommOutboundMessageContext })
    )
    await expect(
      recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    ).resolves.toBeUndefined()
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledWith(connection.id)

    outboundTransport.closeSocketByConnectionId.mockClear()
    messagePickupApi.pickupMessages.mockRejectedValueOnce(new Error('No message pickup protocol registered'))
    await expect(
      recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    ).rejects.toThrow('No message pickup protocol registered')
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()
  })

  test('falls back to a status request when the mediator does not confirm live mode', async () => {
    const recipient = liveModeRecipient({})
    messagePickupApi.setLiveDeliveryMode.mockRejectedValue(new TimeoutError())

    replyToStatusRequests({ messageCount: 0 })
    await recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()

    replyToStatusRequests({ messageCount: 0, liveDelivery: false })
    await recipient.initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledWith(connection.id)
  })

  test('sets live mode on the same socket when the pickup before it times out', async () => {
    messagePickupApi.pickupMessages.mockRejectedValueOnce(new TimeoutError())

    await liveModeRecipient({}).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)

    expect(messagePickupApi.setLiveDeliveryMode).toHaveBeenCalled()
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()
  })

  test('closes the mediator socket when a live mode check gets no reply within 10 seconds', async () => {
    await liveModeRecipient({}).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)

    await vi.advanceTimersByTimeAsync(30000 + 9999)
    expect(messageSender.sendMessage.mock.calls[0][0].message).toBeInstanceOf(DidCommStatusRequestV2Message)
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledWith(connection.id)
  })

  test('closes the mediator socket when live delivery is still off on the next check', async () => {
    replyToStatusRequests({ messageCount: 1, liveDelivery: false })
    await liveModeRecipient({ liveModeCheckIntervalMs: 100 }).initiateMessagePickup(
      mediationRecord,
      DidCommMediatorPickupStrategy.PickUpV2LiveMode
    )

    await vi.advanceTimersByTimeAsync(150)
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledWith(connection.id)
  })
})
