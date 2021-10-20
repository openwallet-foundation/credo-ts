import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { DidCommService } from '../src/modules/connections/models/did/service'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { OutOfBandModule } from '../src/modules/oob/OutOfBandModule'

import { getBaseConfig } from './helpers'

// Maybe it's not bad to import from package?
import { ConnectionService, IndyAgentService } from '@aries-framework/core'

const faberConfig = getBaseConfig('Faber Agent Connections', {
  endpoints: ['rxjs:faber'],
})
const aliceConfig = getBaseConfig('Alice Agent Connections', {
  endpoints: ['rxjs:alice'],
})

describe('out of band', () => {
  let faberAgent: Agent
  let aliceAgent: Agent

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown({
      deleteWallet: true,
    })
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
  })

  // Sender
  // create OOB invitation with available handshake protocols and services
  // - use discover feature to recognize what protocols are available, or maybe connections module should say what protocols it supports
  // - use connection service/agent config to get routing and recipient keys information (create connection)
  // - OutOfBandService could create base OOB message
  // - OutOfBandModule could call OOB service and append handshake protocols and services available

  // Receiver
  // create a connection based on handshake protocol in OOB invitation
  // send a `handshake-reuse` message to service from OOB invitation and wait for `handshake-reuse-accepted`
  // dispatch messages from `requests` array, an agent must responsd to those messages via a newly created or existing connection

  // Where/How to start when developing new feature, e2e test, module, service, something else?
  // What about a constraint for the usage of service from another service?

  test('create OOB connection invitaion', async () => {
    const outOfBandModule = faberAgent.injectionContainer.resolve(OutOfBandModule)
    const connectionService = faberAgent.injectionContainer.resolve(ConnectionService)

    const { outOfBandMessage, connectionRecord } = await outOfBandModule.createInvitation()

    // eslint-disable-next-line no-console
    console.log(outOfBandMessage.toJSON())

    // expect supported handshake protocols
    expect(outOfBandMessage.handshakeProtocols).toContain('https://didcomm.org/connections/1.0')

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new IndyAgentService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    // expect connection, how to identify connection?, maybe via OutOfBandRecord
    // expect OutOfBandRecord in `init` state
    const createdConnectionRecord = await connectionService.findById(connectionRecord.id)
    expect((createdConnectionRecord?.didDoc.service[0] as DidCommService).recipientKeys).toEqual(service.recipientKeys)
    // TODO Should we also check routingKeys?
  })

  // test('make a connection based on OOB invitation', async () => {
  //   const {
  //     invitation,
  //     connectionRecord: { id: faberAliceConnectionId },
  //   } = await faberAgent.oob.createInvitation()

  //   const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

  //   // Create first connection
  //   let aliceFaberConnection = await aliceAgent.oob.receiveInvitationFromUrl(invitationUrl)
  //   aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection.id)
  //   expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

  //   const faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnectionId)
  //   expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
  //   expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

  //   expect(faberAliceConnection.state).toBe(ConnectionState.Complete)
  // })

  // test('make new connection based on OOB invitation', () => {})
  // test('re-use existing connection based on OOB invitation', () => {})
})
