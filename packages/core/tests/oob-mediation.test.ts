/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AgentMessageProcessedEvent } from '../src/agent/Events'
import type { OutOfBandDidCommService } from '../src/modules/oob'

import { filter, firstValueFrom, map, Subject, timeout } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { getIndySdkModules } from '../../indy-sdk/tests/setupIndySdkModule'
import { Agent } from '../src/agent/Agent'
import { AgentEventTypes } from '../src/agent/Events'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { ConnectionType } from '../src/modules/connections/models/ConnectionType'
import { didKeyToVerkey } from '../src/modules/dids/helpers'
import {
  KeylistUpdateMessage,
  KeylistUpdateAction,
  MediationState,
  MediatorPickupStrategy,
} from '../src/modules/routing'

import { getAgentOptions, waitForBasicMessage } from './helpers'

const faberAgentOptions = getAgentOptions(
  'OOB mediation - Faber Agent',
  {
    endpoints: ['rxjs:faber'],
  },
  getIndySdkModules()
)
const aliceAgentOptions = getAgentOptions(
  'OOB mediation - Alice Recipient Agent',
  {
    endpoints: ['rxjs:alice'],
    // FIXME: discover features returns that we support this protocol, but we don't support all roles
    // we should return that we only support the mediator role so we don't have to explicitly declare this
    mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
  },
  getIndySdkModules()
)
const mediatorAgentOptions = getAgentOptions(
  'OOB mediation - Mediator Agent',
  {
    endpoints: ['rxjs:mediator'],
    autoAcceptMediationRequests: true,
  },
  getIndySdkModules()
)

describe('out of band with mediation', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    handshake: true,
    multiUseInvitation: false,
  }

  let faberAgent: Agent
  let aliceAgent: Agent
  let mediatorAgent: Agent

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
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mediatorAgent.initialize()

    // ========== Make a connection between Alice and Mediator agents ==========
    const mediationOutOfBandRecord = await mediatorAgent.oob.createInvitation(makeConnectionConfig)
    const { outOfBandInvitation: mediatorOutOfBandInvitation } = mediationOutOfBandRecord
    const mediatorUrlMessage = mediatorOutOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceMediatorConnection } = await aliceAgent.oob.receiveInvitationFromUrl(
      mediatorUrlMessage
    )

    aliceMediatorConnection = await aliceAgent.connections.returnWhenIsConnected(aliceMediatorConnection!.id)
    expect(aliceMediatorConnection.state).toBe(DidExchangeState.Completed)

    // Tag the connection with an initial type
    aliceMediatorConnection = await aliceAgent.connections.addConnectionType(aliceMediatorConnection.id, 'initial-type')

    let [mediatorAliceConnection] = await mediatorAgent.connections.findAllByOutOfBandId(mediationOutOfBandRecord.id)
    mediatorAliceConnection = await mediatorAgent.connections.returnWhenIsConnected(mediatorAliceConnection!.id)
    expect(mediatorAliceConnection.state).toBe(DidExchangeState.Completed)

    // ========== Set mediation between Alice and Mediator agents ==========
    let connectionTypes = await aliceAgent.connections.getConnectionTypes(aliceMediatorConnection.id)
    expect(connectionTypes).toMatchObject(['initial-type'])

    const mediationRecord = await aliceAgent.mediationRecipient.requestAndAwaitGrant(aliceMediatorConnection)
    connectionTypes = await aliceAgent.connections.getConnectionTypes(mediationRecord.connectionId)
    expect(connectionTypes.sort()).toMatchObject(['initial-type', ConnectionType.Mediator].sort())
    await aliceAgent.connections.removeConnectionType(mediationRecord.connectionId, 'initial-type')
    connectionTypes = await aliceAgent.connections.getConnectionTypes(mediationRecord.connectionId)
    expect(connectionTypes).toMatchObject([ConnectionType.Mediator])
    expect(mediationRecord.state).toBe(MediationState.Granted)

    await aliceAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    await aliceAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
    const defaultMediator = await aliceAgent.mediationRecipient.findDefaultMediator()
    expect(defaultMediator?.id).toBe(mediationRecord.id)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await mediatorAgent.shutdown()
    await mediatorAgent.wallet.delete()
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
    // ========== Make a connection between Alice and Faber ==========
    const outOfBandRecord = await faberAgent.oob.createInvitation({ multiUseInvitation: false })

    const { outOfBandInvitation } = outOfBandRecord
    const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage)

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    let [faberAliceConnection] = await faberAgent.connections.findAllByOutOfBandId(outOfBandRecord.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)

    await aliceAgent.basicMessages.sendMessage(aliceFaberConnection.id, 'hello')
    const basicMessage = await waitForBasicMessage(faberAgent, {})

    expect(basicMessage.content).toBe('hello')
  })

  test(`create and delete OOB invitation when using mediation`, async () => {
    // Alice creates an invitation: the key is notified to her mediator

    const keyAddMessagePromise = firstValueFrom(
      mediatorAgent.events.observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed).pipe(
        filter((event) => event.payload.message.type === KeylistUpdateMessage.type.messageTypeUri),
        map((event) => event.payload.message as KeylistUpdateMessage),
        timeout(5000)
      )
    )

    const outOfBandRecord = await aliceAgent.oob.createInvitation({})
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

    await aliceAgent.oob.deleteById(outOfBandRecord.id)

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
