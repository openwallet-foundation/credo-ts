/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { ConnectionType } from '../src/modules/connections/models/ConnectionType'
import { MediationState, MediatorPickupStrategy } from '../src/modules/routing'

import { getBaseConfig, waitForBasicMessage } from './helpers'

const faberConfig = getBaseConfig('OOB mediation - Faber Agent', {
  endpoints: ['rxjs:faber'],
})
const aliceConfig = getBaseConfig('OOB mediation - Alice Recipient Agent', {
  endpoints: ['rxjs:alice'],
  // FIXME: discover features returns that we support this protocol, but we don't support all roles
  // we should return that we only support the mediator role so we don't have to explicitly declare this
  mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
})
const mediatorConfig = getBaseConfig('OOB mediation - Mediator Agent', {
  endpoints: ['rxjs:mediator'],
  autoAcceptMediationRequests: true,
})

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

    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    mediatorAgent = new Agent(mediatorConfig.config, mediatorConfig.agentDependencies)
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mediatorAgent.initialize()
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
    // ========== Make a connection between Alice and Mediator agents ==========
    const mediationOutOfBandRecord = await mediatorAgent.oob.createInvitation(makeConnectionConfig)
    const { outOfBandInvitation: mediatorOutOfBandInvitation } = mediationOutOfBandRecord
    const mediatorUrlMessage = mediatorOutOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceMediatorConnection } = await aliceAgent.oob.receiveInvitationFromUrl(
      mediatorUrlMessage
    )

    aliceMediatorConnection = await aliceAgent.connections.returnWhenIsConnected(aliceMediatorConnection!.id)
    expect(aliceMediatorConnection.state).toBe(DidExchangeState.Completed)

    let [mediatorAliceConnection] = await mediatorAgent.connections.findAllByOutOfBandId(mediationOutOfBandRecord.id)
    mediatorAliceConnection = await mediatorAgent.connections.returnWhenIsConnected(mediatorAliceConnection!.id)
    expect(mediatorAliceConnection.state).toBe(DidExchangeState.Completed)

    // ========== Set meadiation between Alice and Mediator agents ==========
    const mediationRecord = await aliceAgent.mediationRecipient.requestAndAwaitGrant(aliceMediatorConnection)
    const connectonRecord = await aliceAgent.connections.findById(mediationRecord.connectionId)
    expect(connectonRecord?.getTag('connectionType')).toBe(ConnectionType.Mediator)
    expect(mediationRecord.state).toBe(MediationState.Granted)

    await aliceAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    await aliceAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
    const defaultMediator = await aliceAgent.mediationRecipient.findDefaultMediator()
    expect(defaultMediator?.id).toBe(mediationRecord.id)

    // ========== Make a connection between Alice and Faber ==========
    const outOfBandRecord = await faberAgent.oob.createInvitation(makeConnectionConfig)
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
})
