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
import { DidCommModule } from '../../../DidCommModule'
import { DidCommModuleConfig, type DidCommModuleConfigOptions } from '../../../DidCommModuleConfig'
import { MessageSendingError } from '../../../errors'
import type { DidCommOutboundMessageContext } from '../../../models'
import { type DidCommOutboundWebSocketClosedEvent, DidCommTransportEventTypes } from '../../../transport'
import { DidCommBasicMessageEventTypes } from '../../basic-messages'
import { DidCommConnectionRecord, DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../connections'
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
    closeSocketByConnectionId: vi.fn((): boolean => {
      emitSocketClosed()
      return true
    }),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig({ transports: { outbound: [outboundTransport] } })],
    ],
  })
  const stop$ = new Subject<boolean>()
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, stop$)
  const messagePickupApi = {
    pickupMessages: vi.fn(async () => {}),
    setLiveDeliveryMode: vi.fn(async () => {}),
  }

  function liveModeRecipient(config: DidCommMediationRecipientModuleConfigOptions): DidCommMediationRecipientApi {
    return new DidCommMediationRecipientApi(
      {} as never,
      { getById: async () => connection } as never,
      {} as never,
      {} as never,
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

  function socketNotOpen(): MessageSendingError {
    return new MessageSendingError('Socket is not open', {
      outboundMessageContext: {} as DidCommOutboundMessageContext,
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

  test('still rejects when live mode setup fails at start', async () => {
    messagePickupApi.setLiveDeliveryMode.mockRejectedValueOnce(socketNotOpen())

    await expect(
      liveModeRecipient({}).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    ).rejects.toThrow(MessageSendingError)
    expect(outboundTransport.closeSocketByConnectionId).not.toHaveBeenCalled()
  })

  test('closes the mediator socket so the loop retries when live mode setup fails on a reconnect', async () => {
    await liveModeRecipient({}).initiateMessagePickup(mediationRecord, DidCommMediatorPickupStrategy.PickUpV2LiveMode)
    messagePickupApi.pickupMessages.mockRejectedValueOnce(new TimeoutError())
    messagePickupApi.setLiveDeliveryMode.mockRejectedValueOnce(socketNotOpen())

    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(10000)
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledTimes(2)
    expect(messagePickupApi.setLiveDeliveryMode).toHaveBeenCalledTimes(3)

    messagePickupApi.pickupMessages.mockRejectedValueOnce(new Error('No message pickup protocol registered'))
    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(10000)
    expect(outboundTransport.closeSocketByConnectionId).toHaveBeenCalledTimes(2)
  })

  test('resets the reconnect backoff only once a setup succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    await liveModeRecipient({ baseMediatorReconnectionIntervalMs: 1000 }).initiateMessagePickup(
      mediationRecord,
      DidCommMediatorPickupStrategy.PickUpV2LiveMode
    )
    messagePickupApi.setLiveDeliveryMode.mockRejectedValueOnce(socketNotOpen())

    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(1000 + 1999)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(3)

    emitSocketClosed()
    await vi.advanceTimersByTimeAsync(1000)
    expect(messagePickupApi.pickupMessages).toHaveBeenCalledTimes(4)
  })
})
