import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { CredentialRecord, CredentialOfferTemplate } from '../src/modules/credentials'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { DidCommService } from '../src/modules/connections/models/did/service'
import { OutOfBandMessage } from '../src/modules/oob/OutOfBandMessage'

import { getBaseConfig, prepareForIssuance } from './helpers'
import { TestLogger } from './logger'

import {
  AgentMessage,
  AriesFrameworkError,
  AutoAcceptCredential,
  ConnectionState,
  CredentialPreview,
  CredentialState,
  LogLevel,
} from '@aries-framework/core' // Maybe it's not bad to import from package?

const faberConfig = getBaseConfig('Faber Agent OOB', {
  endpoints: ['rxjs:faber'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:faber'),
})
const aliceConfig = getBaseConfig('Alice Agent OOB', {
  endpoints: ['rxjs:alice'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:alice'),
})

describe('out of band', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    handshake: true,
  }

  const issueCredentialConfig = {
    goal: 'To issue a credential',
    goalCode: 'issue-vc',
    label: 'Faber College',
    handshake: false,
  }

  const receiveMessageConfig = {
    autoAccept: false,
  }

  let faberAgent: Agent
  let aliceAgent: Agent
  let credentialTemplate: CredentialOfferTemplate

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

    const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'profile_picture', 'x-ray'])

    credentialTemplate = {
      credentialDefinitionId: definition.id,
      preview: CredentialPreview.fromRecord({}),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown({
      deleteWallet: true,
    })
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
  })

  test('throw error when there is no handshake or message', async () => {
    await expect(faberAgent.oob.createMessage({ handshake: false })).rejects.toEqual(
      new AriesFrameworkError('One or both of handshake_protocols and requests~attach MUST be included in the message.')
    )
  })

  test('create OOB message only with handshake', async () => {
    const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage(makeConnectionConfig)

    // expect supported handshake protocols
    expect(outOfBandMessage.handshakeProtocols).toContain('https://didcomm.org/connections/1.0')
    expect(outOfBandMessage.getRequests()).toBeUndefined()

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new DidCommService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    const createdConnectionRecord = await faberAgent.connections.findById(connectionRecord?.id || '')
    const createdConnectionRecordService = createdConnectionRecord?.didDoc.service[0] as DidCommService
    expect(createdConnectionRecordService?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecordService?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecordService?.routingKeys).toEqual(service.routingKeys)
  })

  test('create OOB message only with requests', async () => {
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage(
      { handshake: false },
      offerMessage
    )

    // expect supported handshake protocols
    expect(outOfBandMessage.handshakeProtocols).toBeUndefined()
    expect(connectionRecord).toBeUndefined()
    expect(outOfBandMessage.getRequests()).toHaveLength(1)

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new DidCommService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )
  })

  test('create OOB message with both handshake and requests', async () => {
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage({ handshake: true }, offerMessage)

    // expect supported handshake protocols
    expect(outOfBandMessage.handshakeProtocols).toContain('https://didcomm.org/connections/1.0')
    expect(outOfBandMessage.getRequests()).toHaveLength(1)

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new DidCommService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    const createdConnectionRecord = await faberAgent.connections.findById(connectionRecord?.id || '')
    const createdConnectionRecordService = createdConnectionRecord?.didDoc.service[0] as DidCommService
    expect(createdConnectionRecordService?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecordService?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecordService?.routingKeys).toEqual(service.routingKeys)
  })

  test('receive OOB connection invitation', async () => {
    const { outOfBandMessage } = await faberAgent.oob.createMessage(makeConnectionConfig)

    const connectionRecord = await aliceAgent.oob.receiveMessage(outOfBandMessage, { autoAccept: false })

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new DidCommService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    const createdConnectionRecord = await aliceAgent.connections.findById(connectionRecord?.id || '')
    expect(createdConnectionRecord?.invitation?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecord?.invitation?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecord?.invitation?.routingKeys).toEqual(service.routingKeys)
    expect(createdConnectionRecord?.state).toEqual(ConnectionState.Invited)
  })

  test('make a connection based on OOB invitation', async () => {
    // eslint-disable-next-line prefer-const
    let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createMessage(
      makeConnectionConfig
    )

    let aliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, { autoAccept: true })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection?.id || '')
    expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection?.id || '')
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

    expect(faberAliceConnection.state).toBe(ConnectionState.Complete)
  })

  test('process credential offer requests based on OOB message', async () => {
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const { outOfBandMessage } = await faberAgent.oob.createMessage(issueCredentialConfig, offerMessage)

    await aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)

    let credentials: CredentialRecord[] = []
    while (credentials.length < 1) {
      credentials = await aliceAgent.credentials.getAll()
      await wait(100)
    }

    expect(credentials).toHaveLength(1)
    const [credential] = credentials
    expect(credential.state).toBe(CredentialState.OfferReceived)
  })

  test('create connection and process requests', async () => {
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const service = new DidCommService({
      id: '#inline',
      serviceEndpoint: 'rxjs:faber',
      priority: 0,
      recipientKeys: ['somekey'],
      routingKeys: [],
    })

    const outOfBandMessage = new OutOfBandMessage({ services: [service] })
    outOfBandMessage.handshakeProtocols = ['https://didcomm.org/connections/1.0']
    outOfBandMessage.addRequest(offerMessage)

    const connectionRecord = await aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)

    const createdConnectionRecord = await aliceAgent.connections.findById(connectionRecord?.id || '')
    expect(createdConnectionRecord?.invitation?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecord?.invitation?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecord?.invitation?.routingKeys).toEqual(service.routingKeys)
    expect(createdConnectionRecord?.state).toEqual(ConnectionState.Invited)

    let credentials: CredentialRecord[] = []
    while (credentials.length < 2) {
      credentials = await aliceAgent.credentials.getAll()
      await wait(100)
    }

    expect(credentials).toHaveLength(2)
    const [credential] = credentials
    expect(credential.state).toBe(CredentialState.OfferReceived)
  })

  test('throw an error when the OOB message does not contain either handshake or requests', async () => {
    const outOfBandMessage = new OutOfBandMessage({ services: [] })

    await expect(aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)).rejects.toEqual(
      new AriesFrameworkError('One or both of handshake_protocols and requests~attach MUST be included in the message.')
    )
  })
})

function wait(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
