/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { MediationState } from '../src/modules/routing'

import { getBaseConfig, waitForBasicMessage } from './helpers'
import { TestLogger } from './logger'

import { LogLevel } from '@aries-framework/core' // Maybe it's not bad to import from package?

const faberConfig = getBaseConfig('OOB mediation - Faber Agent', {
  endpoints: ['rxjs:faber'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:faber'),
})
const aliceConfig = getBaseConfig('OOB mediation - Alice Recipient Agent', {
  endpoints: ['rxjs:alice'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:alice'),
})
const mediatorConfig = getBaseConfig('OOB mediation - Mediator Agent', {
  endpoints: ['rxjs:mediator'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:mediator'),
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
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(mediatorMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
    await aliceAgent.initialize()

    mediatorAgent = new Agent(mediatorConfig.config, mediatorConfig.agentDependencies)
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
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
    const mediatorRouting = await mediatorAgent.mediationRecipient.getRouting({})
    const mediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      ...makeConnectionConfig,
      routing: mediatorRouting,
    })
    const { outOfBandMessage: mediatorOutOfBandMessage } = mediationOutOfBandRecord
    const mediatorUrlMessage = mediatorOutOfBandMessage.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceMediatorConnection } = await aliceAgent.oob.receiveInvitationFromUrl(
      mediatorUrlMessage
    )

    aliceMediatorConnection = await aliceAgent.connections.returnWhenIsConnected(aliceMediatorConnection!.id)
    expect(aliceMediatorConnection.state).toBe(DidExchangeState.Completed)

    let mediatorAliceConnection = await mediatorAgent.connections.findByOutOfBandId(mediationOutOfBandRecord.id)
    mediatorAliceConnection = await mediatorAgent.connections.returnWhenIsConnected(mediatorAliceConnection!.id)
    expect(mediatorAliceConnection.state).toBe(DidExchangeState.Completed)

    // ========== Set meadiation between Alice and Mediator agents ==========
    const mediationRecord = await aliceAgent.mediationRecipient.requestAndAwaitGrant(aliceMediatorConnection)
    expect(mediationRecord.state).toBe(MediationState.Granted)

    await aliceAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    await aliceAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
    const defaultMediator = await aliceAgent.mediationRecipient.findDefaultMediator()
    expect(defaultMediator?.id).toBe(mediationRecord.id)

    // ========== Make a connection between Alice and Faber ==========
    const faberRouting = await faberAgent.mediationRecipient.getRouting({})
    const outOfBandRecord = await faberAgent.oob.createInvitation({ ...makeConnectionConfig, routing: faberRouting })
    const { outOfBandMessage } = outOfBandRecord
    const urlMessage = outOfBandMessage.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage)

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    let faberAliceConnection = await faberAgent.connections.findByOutOfBandId(outOfBandRecord.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)

    await aliceAgent.basicMessages.sendMessage(aliceFaberConnection.id, 'hello')
    const basicMessage = await waitForBasicMessage(faberAgent, {})

    expect(basicMessage.content).toBe('hello')
  })
})
