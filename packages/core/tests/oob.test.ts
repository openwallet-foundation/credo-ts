/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { CredentialRecord, CredentialOfferTemplate } from '../src/modules/credentials'
import type { AgentMessageReceivedEvent } from '@aries-framework/core'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { DidCommService } from '../src/modules/dids'
import { OutOfBandMessage } from '../src/modules/oob/messages'

import { TestMessage } from './TestMessage'
import { getBaseConfig, prepareForIssuance } from './helpers'
import { TestLogger } from './logger'

import {
  AgentEventTypes,
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
    multiUseInvitation: false,
  }

  const issueCredentialConfig = {
    goal: 'To issue a credential',
    goalCode: 'issue-vc',
    label: 'Faber College',
    handshake: false,
    multiUseInvitation: false,
  }

  const receiveMessageConfig = {
    autoAcceptConnection: false,
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
      preview: CredentialPreview.fromRecord({
        name: 'name',
        age: 'age',
        profile_picture: 'profile_picture',
        'x-ray': 'x-ray',
      }),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  afterEach(async () => {
    const credentials = await aliceAgent.credentials.getAll()
    for (const credential of credentials) {
      await aliceAgent.credentials.deleteById(credential.id)
    }

    const connections = await faberAgent.connections.getAll()
    for (const connection of connections) {
      await faberAgent.connections.deleteById(connection.id)
    }

    jest.resetAllMocks()
  })

  describe('createMessage', () => {
    test('throw error when there is no handshake or message', async () => {
      await expect(faberAgent.oob.createMessage({ label: 'test-connection', handshake: false })).rejects.toEqual(
        new AriesFrameworkError(
          'One or both of handshake_protocols and requests~attach MUST be included in the message.'
        )
      )
    })

    test('create OOB message only with handshake', async () => {
      const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage(makeConnectionConfig)

      // expect supported handshake protocols
      expect(outOfBandMessage.handshakeProtocols).toContain(HandshakeProtocol.DidExchange)
      expect(outOfBandMessage.getRequests()).toBeUndefined()

      // expect contains services
      const [service] = outOfBandMessage.services as DidCommService[]
      expect(service).toMatchObject(
        new DidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          priority: 0,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
        })
      )

      const createdConnectionRecord = await faberAgent.connections.findById(connectionRecord!.id)
      const createdConnectionRecordService = createdConnectionRecord?.didDoc.service[0] as DidCommService
      expect(createdConnectionRecordService?.serviceEndpoint).toEqual(service.serviceEndpoint)
      expect(createdConnectionRecordService?.recipientKeys).toEqual(service.recipientKeys)
      expect(createdConnectionRecordService?.routingKeys).toEqual(service.routingKeys)
    })

    test('create OOB message only with requests', async () => {
      const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
      const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage({
        label: 'test-connection',
        handshake: false,
        messages: [offerMessage],
      })

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
      const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createMessage({
        label: 'test-connection',
        handshake: true,
        handshakeProtocols: [HandshakeProtocol.Connections],
        messages: [offerMessage],
      })

      // expect supported handshake protocols
      expect(outOfBandMessage.handshakeProtocols).toContain(HandshakeProtocol.Connections)
      expect(outOfBandMessage.getRequests()).toHaveLength(1)

      // expect contains services
      const [service] = outOfBandMessage.services as DidCommService[]
      expect(service).toMatchObject(
        new DidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          priority: 0,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
        })
      )

      const createdConnectionRecord = await faberAgent.connections.findById(connectionRecord!.id)
      const createdConnectionRecordService = createdConnectionRecord?.didDoc.service[0] as DidCommService
      expect(createdConnectionRecordService?.serviceEndpoint).toEqual(service.serviceEndpoint)
      expect(createdConnectionRecordService?.recipientKeys).toEqual(service.recipientKeys)
      expect(createdConnectionRecordService?.routingKeys).toEqual(service.routingKeys)
      expect(createdConnectionRecord?.protocol).toBe(undefined)
    })
  })

  describe('receiveMessage', () => {
    test('receive OOB connection invitation', async () => {
      const { outOfBandMessage } = await faberAgent.oob.createMessage(makeConnectionConfig)

      const connectionRecord = await aliceAgent.oob.receiveMessage(outOfBandMessage, { autoAcceptConnection: false })

      // expect contains services
      const [service] = outOfBandMessage.services as DidCommService[]
      expect(service).toMatchObject(
        new DidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          priority: 0,
          recipientKeys: [expect.any(String)],
          routingKeys: [],
        })
      )

      const createdConnectionRecord = await aliceAgent.connections.findById(connectionRecord!.id)
      expect(createdConnectionRecord?.invitation?.serviceEndpoint).toEqual(service.serviceEndpoint)
      expect(createdConnectionRecord?.invitation?.recipientKeys).toEqual(service.recipientKeys)
      expect(createdConnectionRecord?.invitation?.routingKeys).toEqual(service.routingKeys)
      expect(createdConnectionRecord?.state).toEqual(DidExchangeState.InvitationReceived)
    })

    test(`make a connection with ${HandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
      // eslint-disable-next-line prefer-const
      let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createMessage(
        makeConnectionConfig
      )
      const urlMessage = outOfBandMessage.toUrl({ domain: 'http://example.com' })

      let aliceFaberConnection = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage, {
        autoAcceptConnection: true,
      })

      aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
      expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

      faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
      expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    })

    test(`make a connection with ${HandshakeProtocol.Connections} based on OOB invitation encoded in URL`, async () => {
      // eslint-disable-next-line prefer-const
      let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createMessage({
        ...makeConnectionConfig,
        handshakeProtocols: [HandshakeProtocol.Connections],
      })
      const urlMessage = outOfBandMessage.toUrl({ domain: 'http://example.com' })

      let aliceFaberConnection = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage, {
        autoAcceptConnection: true,
      })

      aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
      expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

      faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
      expect(faberAliceConnection.state).toBe(ConnectionState.Complete)

      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    })

    test('make a connection based on old connection invitation encoded in URL', async () => {
      // eslint-disable-next-line prefer-const
      let { invitation, connectionRecord: faberAliceConnection } = await faberAgent.connections.createConnection()
      const urlMessage = invitation.toUrl({ domain: 'http://example.com' })

      let aliceFaberConnection = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage, {
        autoAcceptConnection: true,
      })

      aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
      expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

      faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

      expect(faberAliceConnection.state).toBe(ConnectionState.Complete)
    })

    test('process credential offer requests based on OOB message', async () => {
      const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
      const { outOfBandMessage } = await faberAgent.oob.createMessage({
        ...issueCredentialConfig,
        messages: [offerMessage],
      })

      const urlMessage = outOfBandMessage.toUrl({ domain: 'http://example.com' })

      await aliceAgent.oob.receiveInvitationFromUrl(urlMessage, receiveMessageConfig)

      let credentials: CredentialRecord[] = []
      while (credentials.length < 1) {
        credentials = await aliceAgent.credentials.getAll()
        await wait(100)
      }

      expect(credentials).toHaveLength(1)
      const [credential] = credentials
      expect(credential.state).toBe(CredentialState.OfferReceived)
    })

    test('do not process requests when a connection is not ready', async () => {
      const eventListener = jest.fn()
      aliceAgent.events.on<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived, eventListener)

      const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
      const { outOfBandMessage } = await faberAgent.oob.createMessage({
        ...makeConnectionConfig,
        messages: [offerMessage],
      })

      // First, we crate a connection but we won't accept it, therefore it won't be ready
      await aliceAgent.oob.receiveMessage(outOfBandMessage, { autoAcceptConnection: false })

      // Event should not be emitted because an agent must wait until the connection is ready
      expect(eventListener).toHaveBeenCalledTimes(0)

      aliceAgent.events.off<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived, eventListener)
    })

    test('make a connection based on OOB invitation and process requests after the acceptation', async () => {
      const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
      // eslint-disable-next-line prefer-const
      let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createMessage({
        ...makeConnectionConfig,
        messages: [offerMessage],
      })

      // First, we crate a connection but we won't accept it, therefore it won't be ready
      let aliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, { autoAcceptConnection: false })

      // Accept connection invitation
      await aliceAgent.connections.acceptInvitation(aliceFaberConnection!.id, {
        label: 'alice',
        autoAcceptConnection: true,
      })

      // Wait until connection is ready
      aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
      faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

      // The credential should be processed when connection is made. It asynchronous so it can take a moment.
      let credentials: CredentialRecord[] = []
      while (credentials.length < 1) {
        credentials = await aliceAgent.credentials.getAll()
        await wait(100)
      }

      expect(credentials).toHaveLength(1)
      const [credential] = credentials
      expect(credential.state).toBe(CredentialState.OfferReceived)
    })

    test('do not create a new connection when connection exists', async () => {
      const { connectionRecord: faberAliceConnection, outOfBandMessage } = await faberAgent.oob.createMessage(
        makeConnectionConfig
      )
      let firstAliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, {
        autoAcceptConnection: true,
      })
      firstAliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(firstAliceFaberConnection!.id)

      const secondAliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, {
        autoAcceptConnection: true,
        reuseConnection: true,
      })

      await aliceAgent.connections.returnWhenIsConnected(secondAliceFaberConnection!.id)

      // We need to wait for the faber connection to be completed because there is a clean up
      // after each test that removes all connections. If we didn't wait here it could case flaky
      // tests when we're trying to access removed records.
      await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)

      expect(firstAliceFaberConnection.id).toEqual(secondAliceFaberConnection?.id)
    })

    test('create a new connection when connection exists and reuse is false', async () => {
      const { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createMessage({
        ...makeConnectionConfig,
        multiUseInvitation: true,
      })
      let firstAliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, {
        autoAcceptConnection: true,
      })
      firstAliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(firstAliceFaberConnection!.id)

      let secondAliceFaberConnection = await aliceAgent.oob.receiveMessage(outOfBandMessage, {
        autoAcceptConnection: true,
        reuseConnection: false,
      })

      secondAliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(secondAliceFaberConnection!.id)
      const faberConnections = await faberAgent.connections.getAll()
      const [firstConnection, secondConnection] = faberConnections.filter((c) => c.id !== faberAliceConnection?.id)

      expect(firstAliceFaberConnection.id).not.toEqual(secondAliceFaberConnection?.id)

      expect(faberConnections).toHaveLength(3)
      expect(faberAliceConnection?.multiUseInvitation).toBe(true)
      expect(faberAliceConnection?.state).toBe(undefined)

      expect(firstConnection.getTag('invitationKey')).toEqual(faberAliceConnection?.verkey)
      expect(secondConnection.getTag('invitationKey')).toEqual(faberAliceConnection?.verkey)

      // We need to wait for the faber connection to be completed because there is a clean up
      // after each test that removes all connections. If we didn't wait here it could case flaky
      // tests when we're trying to access removed records.
      const connections = await faberAgent.connections.getAll()
      for (const connection of connections) {
        if (!connection.multiUseInvitation) {
          await faberAgent.connections.returnWhenIsConnected(connection.id)
        }
      }
    })

    test('throw an error when handshake protocols are not supported', async () => {
      const outOfBandMessage = new OutOfBandMessage({ label: 'test-connection', services: [] })
      const unsupportedProtocol = 'https://didcomm.org/unsupported-connections-protocol/1.0'
      outOfBandMessage.handshakeProtocols = [unsupportedProtocol as HandshakeProtocol]

      await expect(aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)).rejects.toEqual(
        new AriesFrameworkError(
          `Handshake protocols [${unsupportedProtocol}] are not supported. Supported protocols are [https://didcomm.org/didexchange/1.0,https://didcomm.org/connections/1.0]`
        )
      )
    })

    test('throw an error when the OOB message does not contain either handshake or requests', async () => {
      const outOfBandMessage = new OutOfBandMessage({ label: 'test-connection', services: [] })

      await expect(aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)).rejects.toEqual(
        new AriesFrameworkError(
          'One or both of handshake_protocols and requests~attach MUST be included in the message.'
        )
      )
    })

    test('throw an error when the OOB message contains unsupported message request', async () => {
      const testMessage = new TestMessage()
      testMessage.type = 'https://didcomm.org/test-protocol/1.0/test-message'
      const { outOfBandMessage } = await faberAgent.oob.createMessage({
        ...issueCredentialConfig,
        messages: [testMessage],
      })

      await expect(aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)).rejects.toEqual(
        new AriesFrameworkError('There is no message in requests~attach supported by agent.')
      )
    })

    test('throw an error when the OOB message does not contain either handshake or requests', async () => {
      const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
      const { outOfBandMessage } = await faberAgent.oob.createMessage({
        ...issueCredentialConfig,
        messages: [offerMessage],
      })
      outOfBandMessage.services = ['somedid']

      await expect(aliceAgent.oob.receiveMessage(outOfBandMessage, receiveMessageConfig)).rejects.toEqual(
        new AriesFrameworkError('Dids are not currently supported in out-of-band message services attribute.')
      )
    })
  })
})

function wait(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
