import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { DidCommService } from '../src/modules/connections/models/did/service'
import type { CredentialRecord } from '../src/modules/credentials'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { OutOfBandModule } from '../src/modules/oob/OutOfBandModule'

import { getBaseConfig, prepareForIssuance } from './helpers'
import { TestLogger } from './logger'

import {
  AutoAcceptCredential,
  ConnectionService,
  ConnectionState,
  CredentialPreview,
  CredentialService,
  CredentialState,
  IndyAgentService,
  LogLevel,
} from '@aries-framework/core' // Maybe it's not bad to import from package?

const faberConfig = getBaseConfig('Faber Agent Connections', {
  endpoints: ['rxjs:faber'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:faber'),
})
const aliceConfig = getBaseConfig('Alice Agent Connections', {
  endpoints: ['rxjs:alice'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:alice'),
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
    console.log('outOfBandMessage.toJSON()', outOfBandMessage.toJSON())

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

  test('receive OOB connection invitaion', async () => {
    const faberOutOfBandModule = faberAgent.injectionContainer.resolve(OutOfBandModule)
    const { outOfBandMessage } = await faberOutOfBandModule.createInvitation()

    const outOfBandModule = aliceAgent.injectionContainer.resolve(OutOfBandModule)
    const connectionService = aliceAgent.injectionContainer.resolve(ConnectionService)

    const connectionRecord = await outOfBandModule.receiveInvitation(outOfBandMessage, { autoAccept: false })

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
    expect(createdConnectionRecord?.invitation?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecord?.invitation?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecord?.invitation?.routingKeys).toEqual(service.routingKeys)
    // TODO Should we also check routingKeys?
  })

  test('make a connection based on OOB invitation', async () => {
    const faberOutOfBandModule = faberAgent.injectionContainer.resolve(OutOfBandModule)
    // eslint-disable-next-line prefer-const
    let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberOutOfBandModule.createInvitation()

    const outOfBandModule = aliceAgent.injectionContainer.resolve(OutOfBandModule)

    let aliceFaberConnection = await outOfBandModule.receiveInvitation(outOfBandMessage, { autoAccept: true })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection.id)
    expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection.id)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

    expect(faberAliceConnection.state).toBe(ConnectionState.Complete)
  })

  test('make a connection and credential offer requests based on OOB invitation', async () => {
    const {
      schema: { id: schemaId },
      definition: { id: credDefId },
    } = await prepareForIssuance(faberAgent, ['name', 'age', 'profile_picture', 'x-ray'])

    // eslint-disable-next-line no-console
    console.log('issuance has been prepared')

    const faberOutOfBandModule = faberAgent.injectionContainer.resolve(OutOfBandModule)
    const aliceOutOfBandModule = aliceAgent.injectionContainer.resolve(OutOfBandModule)
    // eslint-disable-next-line prefer-const
    let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberOutOfBandModule.createInvitation()

    // eslint-disable-next-line no-console
    console.log('invitation created', outOfBandMessage)

    // add credential request to out of band message
    const credentialService = faberAgent.injectionContainer.resolve(CredentialService)
    const credentialTemplate = {
      credentialDefinitionId: credDefId,
      preview: CredentialPreview.fromRecord({}),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
    const { message, credentialRecord } = await credentialService.createOffer(credentialTemplate)

    // eslint-disable-next-line no-console
    console.log('offer created', message)

    outOfBandMessage.addRequest(message)

    const aliceFaberConnection = await aliceOutOfBandModule.receiveInvitation(outOfBandMessage, { autoAccept: true })
    await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection.id)
    await faberAgent.connections.returnWhenIsConnected(faberAliceConnection.id)

    let credentials: CredentialRecord[] = []
    while (credentials.length === 0) {
      // eslint-disable-next-line no-console
      console.log('get credentials')
      credentials = await aliceAgent.credentials.getAll()
      await wait(200)
    }

    // eslint-disable-next-line no-console
    console.log('credentials', credentials)

    expect(credentials).toHaveLength(1)

    const [credential] = credentials
    expect(credential.state).toBe(CredentialState.OfferReceived)
  })

  // test('make new connection based on OOB invitation', () => {})
  // test('re-use existing connection based on OOB invitation', () => {})
})

function wait(ms = 1000) {
  return new Promise((resolve) => {
    // console.log(`waiting ${ms} ms...`)
    setTimeout(resolve, ms)
  })
}
