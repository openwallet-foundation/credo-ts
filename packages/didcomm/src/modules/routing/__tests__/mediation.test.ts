import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { AgentDependencies } from '../../../../../core/src/agent/AgentDependencies'
import type { InitConfig } from '../../../../../core/src/types'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import { sleep } from '../../../../../core/src/utils/sleep'
import { getAgentOptions, waitForBasicMessage } from '../../../../../core/tests/helpers'
import { DidCommModuleConfigOptions } from '../../../DidCommModuleConfig'
import { ConnectionRecord, HandshakeProtocol } from '../../connections'
import { MediatorPickupStrategy } from '../MediatorPickupStrategy'
import { MediationState } from '../models/MediationState'

const getRecipientAgentOptions = (
  useDidKeyInProtocols = true,
  inMemory = true,
  didCommModuleConfig: DidCommModuleConfigOptions = {}
) =>
  getAgentOptions(
    'Mediation: Recipient',
    {
      ...didCommModuleConfig,
      useDidKeyInProtocols,
      mediationRecipient: {
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
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

const senderAgentOptions = getAgentOptions(
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
  let senderAgent: Agent<(typeof senderAgentOptions)['modules']>

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
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    recipientAgent = new Agent(recipientAgentOptions)
    recipientAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    recipientAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(recipientMessages))
    await recipientAgent.initialize()

    let { connectionRecord } = await recipientAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorOutOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://example.com/ssi',
      }),
      { label: 'wallet' }
    )
    if (!connectionRecord) throw new Error('expected connection record')
    connectionRecord = await recipientAgent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)
    await recipientAgent.didcomm.mediationRecipient.provision(connectionRecord)

    const recipientMediator = await recipientAgent.didcomm.mediationRecipient.findDefaultMediator()
    if (!recipientMediator) {
      throw new Error('expected recipientMediator')
    }
    const recipientMediatorConnection = await recipientAgent.didcomm.connections.getById(recipientMediator.connectionId)

    expect(recipientMediatorConnection).toBeInstanceOf(ConnectionRecord)
    expect(recipientMediatorConnection?.isReady).toBe(true)

    const [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )
    expect(mediatorRecipientConnection?.isReady).toBe(true)

    expect(mediatorRecipientConnection).toBeConnectedWith(recipientMediatorConnection)
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection!)

    expect(recipientMediator?.state).toBe(MediationState.Granted)

    // Initialize sender agent
    senderAgent = new Agent(senderAgentOptions)
    senderAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    const recipientOutOfBandRecord = await recipientAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.Connections],
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
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    expect(senderRecipientConnection).toBeConnectedWith(recipientSenderConnection!)
    expect(recipientSenderConnection?.isReady).toBe(true)
    expect(senderRecipientConnection.isReady).toBe(true)

    recipientSenderConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      recipientSenderConnection?.id
    )

    const message = 'hello, world'
    await senderAgent.didcomm.basicMessages.sendMessage(senderRecipientConnection.id, message)

    const basicMessage = await waitForBasicMessage(recipientAgent, {
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
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const recipientAgentOptions = getRecipientAgentOptions(undefined, false, {
      mediationRecipient: {
        mediatorInvitationUrl: mediatorOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com/ssi',
        }),
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
    })
    // Initialize recipient with mediation connections invitation
    recipientAgent = new Agent(recipientAgentOptions)
    recipientAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    recipientAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(recipientMessages))
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
    expect(recipientMediator.state).toBe(MediationState.Granted)

    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()

    // Restart recipient agent
    await recipientAgent.shutdown()
    await recipientAgent.initialize()

    // Initialize sender agent
    senderAgent = new Agent(senderAgentOptions)
    senderAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    const recipientOutOfBandRecord = await recipientAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.Connections],
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
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    expect(senderRecipientConnection).toBeConnectedWith(recipientSenderConnection!)

    expect(recipientSenderConnection?.isReady).toBe(true)
    expect(senderRecipientConnection.isReady).toBe(true)

    const message = 'hello, world'
    await senderAgent.didcomm.basicMessages.sendMessage(senderRecipientConnection.id, message)

    const basicMessage = await waitForBasicMessage(recipientAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)

    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()
  })
})
