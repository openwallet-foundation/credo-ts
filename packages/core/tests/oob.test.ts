import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AnonCredsCredentialFormatService } from '../../anoncreds/src'
import type { DidCommMessageReceivedEvent } from '../../didcomm/src/DidCommEvents'
import type { DidCommMessage } from '../../didcomm/src/DidCommMessage'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { getAnonCredsIndyModules } from '../../anoncreds/tests/legacyAnonCredsSetup'
import {
  anoncredsDefinitionFourAttributesNoRevocation,
  storePreCreatedAnonCredsDefinition,
} from '../../anoncreds/tests/preCreatedAnonCredsDefinition'
import { DidCommEventTypes } from '../../didcomm/src/DidCommEvents'
import { DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../didcomm/src/modules/connections'
import {
  type CreateCredentialOfferOptions,
  DidCommAutoAcceptCredential,
  DidCommCredentialState,
  type V2DidCommCredentialProtocol,
} from '../../didcomm/src/modules/credentials'
import { DidCommOutOfBandEventTypes } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandEvents'
import { DidCommOutOfBandRole } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandState'
import { OutOfBandDidCommService } from '../../didcomm/src/modules/oob/domain/OutOfBandDidCommService'
import { OutOfBandInvitation } from '../../didcomm/src/modules/oob/messages'
import { Agent } from '../src/agent/Agent'
import { JsonEncoder, JsonTransformer, TypedArrayEncoder } from '../src/utils'

import { TestMessage } from './TestMessage'
import { getAgentOptions, waitForCredentialRecord } from './helpers'
import testLogger from './logger'

import { CredoError, Kms } from '@credo-ts/core'

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Agent OOB',
    {
      endpoints: ['rxjs:faber'],
    },
    {},
    getAnonCredsIndyModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    { requireDidcomm: true }
  )
)
const aliceAgent = new Agent(
  getAgentOptions(
    'Alice Agent OOB',
    {
      endpoints: ['rxjs:alice'],
    },
    {
      logger: testLogger,
    },
    getAnonCredsIndyModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    { requireDidcomm: true }
  )
)

describe('out of band', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    alias: `Faber's connection with Alice`,
    imageUrl: 'http://faber.image.url',
  }

  const issueCredentialConfig = {
    goal: 'To issue a credential',
    goalCode: 'issue-vc',
    label: 'Faber College',
    handshake: false,
  }

  const receiveInvitationConfig = {
    label: 'alice',
    autoAcceptConnection: false,
  }

  let credentialTemplate: CreateCredentialOfferOptions<
    [V2DidCommCredentialProtocol<[AnonCredsCredentialFormatService]>]
  >

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    //await aliceAgent.modules.anoncreds.createLinkSecret()

    const { credentialDefinitionId } = await storePreCreatedAnonCredsDefinition(
      faberAgent,
      anoncredsDefinitionFourAttributesNoRevocation
    )
    credentialTemplate = {
      protocolVersion: 'v2',
      credentialFormats: {
        anoncreds: {
          attributes: [
            {
              name: 'name',
              value: 'name',
            },
            {
              name: 'age',
              value: 'age',
            },
            {
              name: 'profile_picture',
              value: 'profile_picture',
            },
            {
              name: 'x-ray',
              value: 'x-ray',
            },
          ],
          credentialDefinitionId,
        },
      },
      autoAcceptCredential: DidCommAutoAcceptCredential.Never,
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  afterEach(async () => {
    const credentials = await aliceAgent.modules.credentials.getAll()
    for (const credential of credentials) {
      await aliceAgent.modules.credentials.deleteById(credential.id)
    }

    const connections = await faberAgent.modules.connections.getAll()
    for (const connection of connections) {
      await faberAgent.modules.connections.deleteById(connection.id)
    }

    jest.resetAllMocks()
  })

  describe('createInvitation', () => {
    test('throw error when there is no handshake or message', async () => {
      await expect(
        faberAgent.modules.oob.createInvitation({ label: 'test-connection', handshake: false })
      ).rejects.toEqual(
        new CredoError('One or both of handshake_protocols and requests~attach MUST be included in the message.')
      )
    })

    test('throw error when multiUseInvitation is true and messages are provided', async () => {
      await expect(
        faberAgent.modules.oob.createInvitation({
          label: 'test-connection',
          messages: [{} as DidCommMessage],
          multiUseInvitation: true,
        })
      ).rejects.toEqual(new CredoError("Attribute 'multiUseInvitation' can not be 'true' when 'messages' is defined."))
    })

    test('handles empty messages array as no messages being passed', async () => {
      await expect(
        faberAgent.modules.oob.createInvitation({
          messages: [],
          handshake: false,
        })
      ).rejects.toEqual(
        new CredoError('One or both of handshake_protocols and requests~attach MUST be included in the message.')
      )
    })

    test('create OOB record', async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      // expect contains services

      expect(outOfBandRecord.autoAcceptConnection).toBe(true)
      expect(outOfBandRecord.role).toBe(DidCommOutOfBandRole.Sender)
      expect(outOfBandRecord.state).toBe(DidCommOutOfBandState.AwaitResponse)
      expect(outOfBandRecord.alias).toBe(makeConnectionConfig.alias)
      expect(outOfBandRecord.reusable).toBe(false)
      expect(outOfBandRecord.outOfBandInvitation.goal).toBe(makeConnectionConfig.goal)
      expect(outOfBandRecord.outOfBandInvitation.goalCode).toBe(makeConnectionConfig.goalCode)
      expect(outOfBandRecord.outOfBandInvitation.label).toBe(makeConnectionConfig.label)
      expect(outOfBandRecord.outOfBandInvitation.imageUrl).toBe(makeConnectionConfig.imageUrl)
    })

    test('create OOB message only with handshake', async () => {
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)

      // expect supported handshake protocols
      expect(outOfBandInvitation.handshakeProtocols).toContain('https://didcomm.org/didexchange/1.1')
      expect(outOfBandInvitation.getRequests()).toBeUndefined()

      // expect contains services
      const [service] = outOfBandInvitation.getInlineServices()
      expect(service).toMatchObject(
        new OutOfBandDidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          recipientKeys: [expect.stringContaining('did:key:')],
          routingKeys: [],
        })
      )
    })

    test('create OOB message only with requests', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        label: 'test-connection',
        handshake: false,
        messages: [message],
      })

      // expect supported handshake protocols
      expect(outOfBandInvitation.handshakeProtocols).toBeUndefined()
      expect(outOfBandInvitation.getRequests()).toHaveLength(1)

      // expect contains services
      const [service] = outOfBandInvitation.getServices()
      expect(service).toMatchObject(
        new OutOfBandDidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          recipientKeys: [expect.stringContaining('did:key:')],
          routingKeys: [],
        })
      )
    })

    test('create OOB message with both handshake and requests', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        label: 'test-connection',
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        messages: [message],
      })

      // expect supported handshake protocols
      expect(outOfBandInvitation.handshakeProtocols).toContain('https://didcomm.org/connections/1.0')
      expect(outOfBandInvitation.getRequests()).toHaveLength(1)

      // expect contains services
      const [service] = outOfBandInvitation.getInlineServices()
      expect(service).toMatchObject(
        new OutOfBandDidCommService({
          id: expect.any(String),
          serviceEndpoint: 'rxjs:faber',
          recipientKeys: [expect.stringMatching('did:key:')],
          routingKeys: [],
        })
      )
    })

    test('emits OutOfBandStateChanged event', async () => {
      const eventListener = jest.fn()

      faberAgent.events.on(DidCommOutOfBandEventTypes.OutOfBandStateChanged, eventListener)
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        label: 'test-connection',
        handshake: true,
      })

      faberAgent.events.off(DidCommOutOfBandEventTypes.OutOfBandStateChanged, eventListener)

      expect(eventListener).toHaveBeenCalledWith({
        type: DidCommOutOfBandEventTypes.OutOfBandStateChanged,
        metadata: {
          contextCorrelationId: 'default',
        },
        payload: {
          outOfBandRecord,
          previousState: null,
        },
      })
    })
  })

  describe('receiveInvitation', () => {
    test('receive OOB connection invitation', async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      const { outOfBandInvitation } = outOfBandRecord

      const { outOfBandRecord: receivedOutOfBandRecord, connectionRecord } =
        await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, {
          label: 'alice',
          autoAcceptInvitation: false,
          autoAcceptConnection: false,
        })

      expect(connectionRecord).not.toBeDefined()
      expect(receivedOutOfBandRecord.role).toBe(DidCommOutOfBandRole.Receiver)
      expect(receivedOutOfBandRecord.state).toBe(DidCommOutOfBandState.Initial)
      expect(receivedOutOfBandRecord.outOfBandInvitation).toEqual(outOfBandInvitation)
    })

    test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: aliceFaberConnection } =
        await aliceAgent.modules.oob.receiveInvitationFromUrl(urlMessage, { label: 'alice' })
      expect(receivedOutOfBandRecord.state).toBe(DidCommOutOfBandState.PrepareResponse)

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord?.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
      expect(faberAliceConnection?.state).toBe(DidCommDidExchangeState.Completed)

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection!)
      expect(aliceFaberConnection.imageUrl).toBe(makeConnectionConfig.imageUrl)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(faberAliceConnection.alias).toBe(makeConnectionConfig.alias)
    })

    test(`make a connection with ${DidCommHandshakeProtocol.Connections} based on OOB invitation encoded in URL`, async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        ...makeConnectionConfig,
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      })
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitationFromUrl(
        urlMessage,
        { label: 'alice' }
      )

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord?.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
      expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(faberAliceConnection.alias).toBe(makeConnectionConfig.alias)
    })

    test('make a connection based on old connection invitation encoded in URL', async () => {
      const { outOfBandRecord, invitation } = await faberAgent.modules.oob.createLegacyInvitation(makeConnectionConfig)
      const urlMessage = invitation.toUrl({ domain: 'http://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitationFromUrl(
        urlMessage,
        { label: 'alice' }
      )

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)

      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    })

    test('make a connection based on old connection invitation with multiple endpoints uses first endpoint for invitation', async () => {
      const routingKey = Kms.PublicJwk.fromFingerprint(
        'z6MkiP5ghmdLFh1GyGRQQQLVJhJtjQjTpxUY3AnY3h5gu3BE'
      ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
      routingKey.keyId = routingKey.legacyKeyId

      const recipientKey = Kms.PublicJwk.fromFingerprint(
        'z6MkuXrzmDjBoy7r9LA1Czjv9eQXMGr9gt6JBH8zPUMKkCQH'
      ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
      recipientKey.keyId = recipientKey.legacyKeyId

      const { invitation } = await faberAgent.modules.oob.createLegacyInvitation({
        ...makeConnectionConfig,
        routing: {
          endpoints: ['https://endpoint-1.com', 'https://endpoint-2.com'],
          routingKeys: [routingKey],
          recipientKey,
        },
      })

      expect(invitation.serviceEndpoint).toBe('https://endpoint-1.com')
    })

    test('process credential offer requests based on OOB message', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)

      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        ...issueCredentialConfig,
        messages: [message],
      })

      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
      })
      await aliceAgent.modules.oob.receiveInvitationFromUrl(urlMessage, receiveInvitationConfig)

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)
    })

    test('process credential offer requests with legacy did:sov prefix on message type based on OOB message', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)

      // we need to override the message type to use the legacy did:sov prefix
      // @ts-ignore
      message.type = message.type.replace('https://didcomm.org', 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec')
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        ...issueCredentialConfig,
        messages: [message],
      })

      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
      })
      await aliceAgent.modules.oob.receiveInvitationFromUrl(urlMessage, receiveInvitationConfig)

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)
    })

    test('do not process requests when a connection is not ready', async () => {
      const eventListener = jest.fn()
      aliceAgent.events.on<DidCommMessageReceivedEvent>(DidCommEventTypes.DidCommMessageReceived, eventListener)

      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        ...makeConnectionConfig,
        messages: [message],
      })

      // First, we crate a connection but we won't accept it, therefore it won't be ready
      await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, {
        label: 'alice',
        autoAcceptConnection: false,
      })

      // Event should not be emitted because an agent must wait until the connection is ready
      expect(eventListener).toHaveBeenCalledTimes(0)

      aliceAgent.events.off<DidCommMessageReceivedEvent>(DidCommEventTypes.DidCommMessageReceived, eventListener)
    })

    test('make a connection based on OOB invitation and process requests after the acceptation', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        ...makeConnectionConfig,
        messages: [message],
      })
      const { outOfBandInvitation } = outOfBandRecord

      // First, we crate a connection but we won't accept it, therefore it won't be ready
      const { outOfBandRecord: aliceFaberOutOfBandRecord } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandInvitation,
        {
          label: 'alice',
          autoAcceptInvitation: false,
          autoAcceptConnection: false,
        }
      )

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        // We need to create the connection beforehand so it can take a while to complete
        timeoutMs: 20000,
      })

      // Accept connection invitation
      let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.acceptInvitation(
        aliceFaberOutOfBandRecord.id,
        {
          label: 'alice',
          autoAcceptConnection: true,
        }
      )

      // Wait until connection is ready
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)

      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord?.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)
    })

    test('do not create a new connection when no messages and handshake reuse succeeds', async () => {
      const aliceReuseListener = jest.fn()
      const faberReuseListener = jest.fn()

      // Create first connection
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      let { connectionRecord: firstAliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      firstAliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        firstAliceFaberConnection?.id!
      )

      const [firstFaberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)

      // Create second connection
      const outOfBandRecord2 = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)

      // Take over the recipientKeys from the first invitation so they match when encoded
      const [firstInvitationService] = outOfBandRecord.outOfBandInvitation.getInlineServices()
      const [secondInvitationService] = outOfBandRecord2.outOfBandInvitation.getInlineServices()
      secondInvitationService.recipientKeys = firstInvitationService.recipientKeys

      aliceAgent.events.on(DidCommOutOfBandEventTypes.HandshakeReused, aliceReuseListener)
      faberAgent.events.on(DidCommOutOfBandEventTypes.HandshakeReused, faberReuseListener)

      const {
        connectionRecord: secondAliceFaberConnection,
        outOfBandRecord: { id: secondOobRecordId },
      } = await aliceAgent.modules.oob.receiveInvitation(outOfBandRecord2.outOfBandInvitation, {
        label: 'alice',
        reuseConnection: true,
      })

      aliceAgent.events.off(DidCommOutOfBandEventTypes.HandshakeReused, aliceReuseListener)
      faberAgent.events.off(DidCommOutOfBandEventTypes.HandshakeReused, faberReuseListener)
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      await aliceAgent.modules.connections.returnWhenIsConnected(secondAliceFaberConnection?.id!)

      // There shouldn't be any connection records for this oob id, as we reused an existing one
      expect((await faberAgent.modules.connections.findAllByOutOfBandId(secondOobRecordId)).length).toBe(0)

      expect(firstAliceFaberConnection.id).toEqual(secondAliceFaberConnection?.id)

      expect(faberReuseListener).toHaveBeenCalledTimes(1)
      expect(aliceReuseListener).toHaveBeenCalledTimes(1)
      const [[faberEvent]] = faberReuseListener.mock.calls
      const [[aliceEvent]] = aliceReuseListener.mock.calls

      const reuseThreadId = faberEvent.payload.reuseThreadId

      expect(faberEvent).toMatchObject({
        type: DidCommOutOfBandEventTypes.HandshakeReused,
        payload: {
          connectionRecord: {
            id: firstFaberAliceConnection.id,
          },
          outOfBandRecord: {
            id: outOfBandRecord2.id,
          },
          reuseThreadId,
        },
      })

      expect(aliceEvent).toMatchObject({
        type: DidCommOutOfBandEventTypes.HandshakeReused,
        payload: {
          connectionRecord: {
            id: firstAliceFaberConnection.id,
          },
          outOfBandRecord: {
            id: secondOobRecordId,
          },
          reuseThreadId,
        },
      })
    })

    test('create a new connection when connection exists and reuse is false', async () => {
      const reuseListener = jest.fn()

      // Create first connection
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      let { connectionRecord: firstAliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord.outOfBandInvitation,
        {
          label: 'alice',
        }
      )
      firstAliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        firstAliceFaberConnection?.id!
      )

      // Create second connection
      const outOfBandRecord2 = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)

      aliceAgent.events.on(DidCommOutOfBandEventTypes.HandshakeReused, reuseListener)
      faberAgent.events.on(DidCommOutOfBandEventTypes.HandshakeReused, reuseListener)

      const { connectionRecord: secondAliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord2.outOfBandInvitation,
        { label: 'alice', reuseConnection: false }
      )

      aliceAgent.events.off(DidCommOutOfBandEventTypes.HandshakeReused, reuseListener)
      faberAgent.events.off(DidCommOutOfBandEventTypes.HandshakeReused, reuseListener)
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      await aliceAgent.modules.connections.returnWhenIsConnected(secondAliceFaberConnection?.id!)

      // If we're not reusing the connection, the reuse listener shouldn't be called
      expect(reuseListener).not.toHaveBeenCalled()
      expect(firstAliceFaberConnection.id).not.toEqual(secondAliceFaberConnection?.id)

      const faberConnections = await faberAgent.modules.connections.getAll()
      let [firstFaberAliceConnection, secondFaberAliceConnection] = faberConnections
      firstFaberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(
        firstFaberAliceConnection.id
      )
      secondFaberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(
        secondFaberAliceConnection.id
      )

      // expect the two connections contain the two out of band ids
      expect(faberConnections.map((c) => c.outOfBandId)).toEqual(
        expect.arrayContaining([outOfBandRecord.id, outOfBandRecord2.id])
      )

      expect(faberConnections).toHaveLength(2)
      expect(firstFaberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(secondFaberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)
    })

    test('throws an error when the invitation has already been received', async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)
      const { outOfBandInvitation } = outOfBandRecord

      const { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandInvitation,
        { label: 'alice' }
      )

      // Wait until connection is ready
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)

      const [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)
      await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)

      // Try to receive the invitation again
      await expect(aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, { label: 'alice' })).rejects.toThrow(
        new CredoError(
          `An out of band record with invitation ${outOfBandInvitation.id} has already been received. Invitations should have a unique id.`
        )
      )
    })

    test('emits OutOfBandStateChanged event', async () => {
      const eventListener = jest.fn()
      const { outOfBandInvitation, id } = await faberAgent.modules.oob.createInvitation(makeConnectionConfig)

      aliceAgent.events.on(DidCommOutOfBandEventTypes.OutOfBandStateChanged, eventListener)

      const { outOfBandRecord, connectionRecord } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandInvitation,
        {
          label: 'alice',
          autoAcceptConnection: true,
          autoAcceptInvitation: true,
        }
      )

      // Wait for the connection to complete so we don't get wallet closed errors
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      await aliceAgent.modules.connections.returnWhenIsConnected(connectionRecord?.id!)
      aliceAgent.events.off(DidCommOutOfBandEventTypes.OutOfBandStateChanged, eventListener)

      const [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(id)
      await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection.id)

      // Receiving the invitation
      expect(eventListener).toHaveBeenNthCalledWith(1, {
        type: DidCommOutOfBandEventTypes.OutOfBandStateChanged,
        metadata: {
          contextCorrelationId: 'default',
        },
        payload: {
          outOfBandRecord: expect.objectContaining({ state: DidCommOutOfBandState.Initial }),
          previousState: null,
        },
      })

      // Accepting the invitation
      expect(eventListener).toHaveBeenNthCalledWith(2, {
        type: DidCommOutOfBandEventTypes.OutOfBandStateChanged,
        metadata: {
          contextCorrelationId: 'default',
        },
        payload: {
          outOfBandRecord,
          previousState: DidCommOutOfBandState.Initial,
        },
      })
    })

    test.skip('do not create a new connection when connection exists and multiuse is false', async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        ...makeConnectionConfig,
        multiUseInvitation: false,
      })
      const { outOfBandInvitation } = outOfBandRecord

      let { connectionRecord: firstAliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandInvitation,
        { label: 'alice' }
      )
      firstAliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        firstAliceFaberConnection?.id!
      )

      await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, { label: 'alice' })

      // TODO Somehow check agents throws an error or sends problem report

      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord?.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)

      const faberConnections = await faberAgent.modules.connections.getAll()
      expect(faberConnections).toHaveLength(1)
      expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(firstAliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)
    })

    test('throw an error when handshake protocols are not supported', async () => {
      const outOfBandInvitation = new OutOfBandInvitation({ label: 'test-connection', services: [] })
      const unsupportedProtocol = 'https://didcomm.org/unsupported-connections-protocol/1.0'
      outOfBandInvitation.handshakeProtocols = [unsupportedProtocol as DidCommHandshakeProtocol]

      await expect(
        aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, receiveInvitationConfig)
      ).rejects.toEqual(
        new CredoError(
          `Handshake protocols [${unsupportedProtocol}] are not supported. Supported protocols are [https://didcomm.org/didexchange/1.x,https://didcomm.org/connections/1.x]`
        )
      )
    })

    test('throw an error when the OOB message does not contain either handshake or requests', async () => {
      const outOfBandInvitation = new OutOfBandInvitation({ label: 'test-connection', services: [] })

      await expect(
        aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, receiveInvitationConfig)
      ).rejects.toEqual(
        new CredoError('One or both of handshake_protocols and requests~attach MUST be included in the message.')
      )
    })

    test('throw an error when the OOB message contains unsupported message request', async () => {
      const testMessage = new TestMessage()
      testMessage.type = 'https://didcomm.org/test-protocol/1.0/test-message'
      const { outOfBandInvitation } = await faberAgent.modules.oob.createInvitation({
        ...issueCredentialConfig,
        messages: [testMessage],
      })

      await expect(
        aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, receiveInvitationConfig)
      ).rejects.toEqual(new CredoError('There is no message in requests~attach supported by agent.'))
    })

    test(`make two connections with ${DidCommHandshakeProtocol.DidExchange} by reusing the did from the first connection as the 'invitationDid' in oob invitation for the second connection`, async () => {
      const outOfBandRecord1 = await faberAgent.modules.oob.createInvitation({})

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord1.outOfBandInvitation,
        { label: 'alice' }
      )

      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [faberAliceConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord1?.id)
      faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
      expect(faberAliceConnection?.state).toBe(DidCommDidExchangeState.Completed)

      // Use the invitation did from the first connection to create the second connection
      // (first connection's did matches the one used in invitation, since no rotation has been done (multiUse=false))
      const outOfBandRecord2 = await faberAgent.modules.oob.createInvitation({
        invitationDid: faberAliceConnection.did,
      })

      let { connectionRecord: aliceFaberConnection2 } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord2.outOfBandInvitation,
        { label: 'alice' }
      )
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      aliceFaberConnection2 = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection2?.id!)
      expect(aliceFaberConnection2.state).toBe(DidCommDidExchangeState.Completed)

      let [faberAliceConnection2] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord2?.id)
      faberAliceConnection2 = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection2?.id)
      expect(faberAliceConnection2?.state).toBe(DidCommDidExchangeState.Completed)
    })
  })

  describe('messages and connection exchange', () => {
    test('oob exchange with handshake where response is received to invitation', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        handshake: true,
        messages: [message],
      })
      const { outOfBandInvitation } = outOfBandRecord

      await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, { label: 'alice' })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      await faberCredentialRecordPromise
    })

    test('oob exchange with reuse where response is received to invitation', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)

      const routing = await faberAgent.modules.mediationRecipient.getRouting({})
      const connectionOutOfBandRecord = await faberAgent.modules.oob.createInvitation({
        routing,
      })

      // Create connection
      const { connectionRecord } = await aliceAgent.modules.oob.receiveInvitation(
        connectionOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Connection record is undefined')
      await aliceAgent.modules.connections.returnWhenIsConnected(connectionRecord.id)

      // Create offer and reuse
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        routing,
        messages: [message],
      })
      // Create connection
      const { connectionRecord: offerConnectionRecord } = await aliceAgent.modules.oob.receiveInvitation(
        outOfBandRecord.outOfBandInvitation,
        {
          label: 'alice',
          reuseConnection: true,
        }
      )
      if (!offerConnectionRecord) throw new Error('Connection record is undefined')

      // Should be the same, as connection is reused.
      expect(offerConnectionRecord.id).toEqual(connectionRecord.id)

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      await faberCredentialRecordPromise
    })
  })

  describe('connection-less exchange', () => {
    test('oob exchange without handshake where response is received to invitation', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        handshake: false,
        messages: [message],
      })
      const { outOfBandInvitation } = outOfBandRecord

      await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, { label: 'alice' })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      await faberCredentialRecordPromise
    })

    test('oob exchange without handshake where response is received and custom routing is used on recipient', async () => {
      const { message } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        handshake: false,
        messages: [message],
      })
      const { outOfBandInvitation } = outOfBandRecord

      const routing = await aliceAgent.modules.mediationRecipient.getRouting({})

      await aliceAgent.modules.oob.receiveInvitation(outOfBandInvitation, {
        label: 'alice',
        routing,
      })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      const faberCredentialRecord = await faberCredentialRecordPromise

      const faberCredentialRequest = await faberAgent.modules.credentials.findRequestMessage(faberCredentialRecord.id)

      expect(JsonTransformer.toJSON(faberCredentialRequest?.service)).toEqual({
        recipientKeys: [TypedArrayEncoder.toBase58(routing.recipientKey.publicKey.publicKey)],
        serviceEndpoint: routing.endpoints[0],
        routingKeys: routing.routingKeys.map((r) => TypedArrayEncoder.toBase58(r.publicKey.publicKey)),
      })
    })

    test('legacy connectionless exchange where response is received to invitation', async () => {
      const { message, credentialExchangeRecord } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const { invitationUrl } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
        domain: 'http://example.com',
        message,
        recordId: credentialExchangeRecord.id,
      })

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })
      await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      await faberCredentialRecordPromise
    })

    test('legacy connectionless exchange where response is received to invitation and custom routing is used on recipient', async () => {
      const { message, credentialExchangeRecord } = await faberAgent.modules.credentials.createOffer(credentialTemplate)
      const { invitationUrl } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
        domain: 'http://example.com',
        message,
        recordId: credentialExchangeRecord.id,
      })

      const routing = await aliceAgent.modules.mediationRecipient.getRouting({})

      const aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: DidCommCredentialState.OfferReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })
      await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice', routing })

      const aliceCredentialRecord = await aliceCredentialRecordPromise
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.OfferReceived)

      // If we receive the event, we know the processing went well
      const faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
        state: DidCommCredentialState.RequestReceived,
        threadId: message.threadId,
        timeoutMs: 10000,
      })

      await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      const faberCredentialRecord = await faberCredentialRecordPromise

      const faberCredentialRequest = await faberAgent.modules.credentials.findRequestMessage(faberCredentialRecord.id)

      expect(JsonTransformer.toJSON(faberCredentialRequest?.service)).toEqual({
        recipientKeys: [TypedArrayEncoder.toBase58(routing.recipientKey.publicKey.publicKey)],
        serviceEndpoint: routing.endpoints[0],
        routingKeys: routing.routingKeys.map((r) => TypedArrayEncoder.toBase58(r.publicKey.publicKey)),
      })
    })

    test('add ~service decorator to the message and returns invitation url in createLegacyConnectionlessInvitation', async () => {
      const { message, credentialExchangeRecord } = await faberAgent.modules.credentials.createOffer(credentialTemplate)

      const { message: offerMessage, invitationUrl } =
        await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
          recordId: credentialExchangeRecord.id,
          domain: 'https://test.com',
          message,
        })

      expect(offerMessage.service).toMatchObject({
        serviceEndpoint: expect.any(String),
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })

      expect(invitationUrl).toEqual(expect.stringContaining('https://test.com?d_m='))

      const messageBase64 = invitationUrl.split('https://test.com?d_m=')[1]

      expect(JsonEncoder.fromBase64(messageBase64)).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      })
    })
  })
})
