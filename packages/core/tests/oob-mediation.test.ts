import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AgentMessageProcessedEvent } from '../../didcomm/src'
import type { OutOfBandDidCommService } from '../../didcomm/src/modules/oob'

import { Subject, filter, firstValueFrom, map, timeout } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { AgentEventTypes } from '../../didcomm/src'
import { ConnectionType, DidExchangeState, HandshakeProtocol } from '../../didcomm/src/modules/connections'
import {
  KeylistUpdateAction,
  KeylistUpdateMessage,
  MediationState,
  MediatorPickupStrategy,
} from '../../didcomm/src/modules/routing'
import { Agent } from '../src/agent/Agent'
import { didKeyToVerkey } from '../src/modules/dids/helpers'

import { getAgentOptions, waitForBasicMessage } from './helpers'

const faberAgentOptions = getAgentOptions(
  'OOB mediation - Faber Agent',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const aliceAgentOptions = getAgentOptions(
  'OOB mediation - Alice Recipient Agent',
  {
    endpoints: ['rxjs:alice'],
    mediationRecipient: {
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    },
  },
  {},
  {},
  { requireDidcomm: true }
)
const mediatorAgentOptions = getAgentOptions(
  'OOB mediation - Mediator Agent',
  {
    endpoints: ['rxjs:mediator'],
    mediator: { autoAcceptMediationRequests: true },
  },
  {},
  {},
  { requireDidcomm: true }
)

describe('out of band with mediation', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    handshake: true,
    multiUseInvitation: false,
  }

  let faberAgent: Agent<(typeof faberAgentOptions)['modules']>
  let aliceAgent: Agent<(typeof aliceAgentOptions)['modules']>
  let mediatorAgent: Agent<(typeof mediatorAgentOptions)['modules']>

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
      'rxjs:mediator': mediatorMessages,
    }

    faberAgent = new Agent(faberAgentOptions)
    faberAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mediatorAgent.initialize()

    // ========== Make a connection between Alice and Mediator agents ==========
    const mediationOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation(makeConnectionConfig)
    const { outOfBandInvitation: mediatorOutOfBandInvitation } = mediationOutOfBandRecord
    const mediatorUrlMessage = mediatorOutOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceMediatorConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorUrlMessage,
      { label: 'alice' }
    )

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceMediatorConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceMediatorConnection!.id)
    expect(aliceMediatorConnection.state).toBe(DidExchangeState.Completed)

    // Tag the connection with an initial type
    aliceMediatorConnection = await aliceAgent.didcomm.connections.addConnectionType(
      aliceMediatorConnection.id,
      'initial-type'
    )

    let [mediatorAliceConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediationOutOfBandRecord.id
    )
    mediatorAliceConnection = await mediatorAgent.didcomm.connections.returnWhenIsConnected(mediatorAliceConnection?.id)
    expect(mediatorAliceConnection.state).toBe(DidExchangeState.Completed)

    // ========== Set mediation between Alice and Mediator agents ==========
    let connectionTypes = await aliceAgent.didcomm.connections.getConnectionTypes(aliceMediatorConnection.id)
    expect(connectionTypes).toMatchObject(['initial-type'])

    const mediationRecord = await aliceAgent.didcomm.mediationRecipient.requestAndAwaitGrant(aliceMediatorConnection)
    connectionTypes = await aliceAgent.didcomm.connections.getConnectionTypes(mediationRecord.connectionId)
    expect(connectionTypes.sort()).toMatchObject(['initial-type', ConnectionType.Mediator].sort())
    await aliceAgent.didcomm.connections.removeConnectionType(mediationRecord.connectionId, 'initial-type')
    connectionTypes = await aliceAgent.didcomm.connections.getConnectionTypes(mediationRecord.connectionId)
    expect(connectionTypes).toMatchObject([ConnectionType.Mediator])
    expect(mediationRecord.state).toBe(MediationState.Granted)

    await aliceAgent.didcomm.mediationRecipient.setDefaultMediator(mediationRecord)
    await aliceAgent.didcomm.mediationRecipient.initiateMessagePickup(mediationRecord)
    const defaultMediator = await aliceAgent.didcomm.mediationRecipient.findDefaultMediator()
    expect(defaultMediator?.id).toBe(mediationRecord.id)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
    await mediatorAgent.shutdown()
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
    // ========== Make a connection between Alice and Faber ==========
    const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ multiUseInvitation: false })

    const { outOfBandInvitation } = outOfBandRecord
    const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(urlMessage, {
      label: 'alice',
    })

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    let [faberAliceConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)

    await aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'hello')
    const basicMessage = await waitForBasicMessage(faberAgent, {})

    expect(basicMessage.content).toBe('hello')
  })

  test('create and delete OOB invitation when using mediation', async () => {
    // Alice creates an invitation: the key is notified to her mediator

    const keyAddMessagePromise = firstValueFrom(
      mediatorAgent.events.observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed).pipe(
        filter((event) => event.payload.message.type === KeylistUpdateMessage.type.messageTypeUri),
        map((event) => event.payload.message as KeylistUpdateMessage),
        timeout(5000)
      )
    )

    const outOfBandRecord = await aliceAgent.didcomm.oob.createInvitation({})
    const { outOfBandInvitation } = outOfBandRecord

    const keyAddMessage = await keyAddMessagePromise

    expect(keyAddMessage.updates.length).toEqual(1)
    expect(
      keyAddMessage.updates.map((update) => ({
        action: update.action,
        recipientKey: didKeyToVerkey(update.recipientKey),
      }))[0]
    ).toEqual({
      action: KeylistUpdateAction.add,
      recipientKey: didKeyToVerkey((outOfBandInvitation.getServices()[0] as OutOfBandDidCommService).recipientKeys[0]),
    })

    const keyRemoveMessagePromise = firstValueFrom(
      mediatorAgent.events.observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed).pipe(
        filter((event) => event.payload.message.type === KeylistUpdateMessage.type.messageTypeUri),
        map((event) => event.payload.message as KeylistUpdateMessage),
        timeout(5000)
      )
    )

    await aliceAgent.didcomm.oob.deleteById(outOfBandRecord.id)

    const keyRemoveMessage = await keyRemoveMessagePromise
    expect(keyRemoveMessage.updates.length).toEqual(1)
    expect(
      keyRemoveMessage.updates.map((update) => ({
        action: update.action,
        recipientKey: didKeyToVerkey(update.recipientKey),
      }))[0]
    ).toEqual({
      action: KeylistUpdateAction.remove,
      recipientKey: didKeyToVerkey((outOfBandInvitation.getServices()[0] as OutOfBandDidCommService).recipientKeys[0]),
    })
  })
})
