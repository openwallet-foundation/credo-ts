import type { Wallet } from '../../../wallet/Wallet'
import type { Routing } from '../services/ConnectionService'

import { getAgentConfig, getMockConnection, getMockOutOfBand, mockFunction } from '../../../../tests/helpers'
import { AgentMessage } from '../../../agent/AgentMessage'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Key, KeyType } from '../../../crypto'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { uuid } from '../../../utils/uuid'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { AckMessage, AckStatus } from '../../common'
import { DidKey, IndyAgentService } from '../../dids'
import { DidCommV1Service } from '../../dids/domain/service/DidCommV1Service'
import { didDocumentJsonToNumAlgo1Did } from '../../dids/methods/peer/peerDidNumAlgo1'
import { DidRepository } from '../../dids/repository'
import { OutOfBandRole } from '../../oob/domain/OutOfBandRole'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { ConnectionRequestMessage, ConnectionResponseMessage, TrustPingMessage } from '../messages'
import {
  Connection,
  DidDoc,
  EmbeddedAuthentication,
  Ed25119Sig2018,
  DidExchangeRole,
  DidExchangeState,
} from '../models'
import { ConnectionRepository } from '../repository/ConnectionRepository'
import { ConnectionService } from '../services/ConnectionService'
import { convertToNewDidDocument } from '../services/helpers'

jest.mock('../repository/ConnectionRepository')
jest.mock('../../dids/repository/DidRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const connectionImageUrl = 'https://example.com/image.png'

describe('ConnectionService', () => {
  const agentConfig = getAgentConfig('ConnectionServiceTest', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  let wallet: Wallet
  let connectionRepository: ConnectionRepository
  let didRepository: DidRepository
  let connectionService: ConnectionService
  let eventEmitter: EventEmitter
  let myRouting: Routing

  beforeAll(async () => {
    wallet = new IndyWallet(agentConfig)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(agentConfig)
    connectionRepository = new ConnectionRepositoryMock()
    didRepository = new DidRepositoryMock()
    connectionService = new ConnectionService(wallet, agentConfig, connectionRepository, didRepository, eventEmitter)
    myRouting = {
      did: 'fakeDid',
      verkey: 'fakeVerkey',
      endpoints: agentConfig.endpoints ?? [],
      routingKeys: [],
      mediatorId: 'fakeMediatorId',
    }
  })

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(5)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse })
      const config = { routing: myRouting }

      const { connectionRecord, message } = await connectionService.createRequest(outOfBand, config)

      expect(connectionRecord.state).toBe(DidExchangeState.RequestSent)
      expect(message.label).toBe(agentConfig.label)
      expect(message.connection.did).toBe('fakeDid')
      expect(message.connection.didDoc).toEqual(
        new DidDoc({
          id: 'fakeDid',
          publicKey: [
            new Ed25119Sig2018({
              id: `fakeDid#1`,
              controller: 'fakeDid',
              publicKeyBase58: 'fakeVerkey',
            }),
          ],
          authentication: [
            new EmbeddedAuthentication(
              new Ed25119Sig2018({
                id: `fakeDid#1`,
                controller: 'fakeDid',
                publicKeyBase58: 'fakeVerkey',
              })
            ),
          ],
          service: [
            new IndyAgentService({
              id: `fakeDid#IndyAgentService`,
              serviceEndpoint: agentConfig.endpoints[0],
              recipientKeys: ['fakeVerkey'],
              routingKeys: [],
            }),
          ],
        })
      )
      expect(message.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a connection request message containing a custom label', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse })
      const config = { label: 'Custom label', routing: myRouting }

      const { message } = await connectionService.createRequest(outOfBand, config)

      expect(message.label).toBe('Custom label')
    })

    it('returns a connection request message containing a custom image url', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse })
      const config = { imageUrl: 'custom-image-url', routing: myRouting }

      const { message } = await connectionService.createRequest(outOfBand, config)

      expect(message.imageUrl).toBe('custom-image-url')
    })

    it(`throws an error when out-of-band role is not ${OutOfBandRole.Receiver}`, async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Sender, state: OutOfBandState.PrepareResponse })
      const config = { routing: myRouting }

      return expect(connectionService.createRequest(outOfBand, config)).rejects.toThrowError(
        `Invalid out-of-band record role ${OutOfBandRole.Sender}, expected is ${OutOfBandRole.Receiver}.`
      )
    })

    const invalidConnectionStates = [OutOfBandState.Initial, OutOfBandState.AwaitResponse, OutOfBandState.Done]
    test.each(invalidConnectionStates)(
      `throws an error when out-of-band state is %s and not ${OutOfBandState.PrepareResponse}`,
      (state) => {
        expect.assertions(1)

        const outOfBand = getMockOutOfBand({ state })
        const config = { routing: myRouting }

        return expect(connectionService.createRequest(outOfBand, config)).rejects.toThrowError(
          `Invalid out-of-band record state ${state}, valid states are: ${OutOfBandState.PrepareResponse}.`
        )
      }
    )
  })

  describe('processRequest', () => {
    it('returns a connection record containing the information from the connection request', async () => {
      expect.assertions(5)

      const theirDid = 'their-did'
      const theirKey = Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519)
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [
          new EmbeddedAuthentication(
            new Ed25119Sig2018({
              id: `${theirDid}#key-id`,
              controller: theirDid,
              publicKeyBase58: theirKey.publicKeyBase58,
            })
          ),
        ],
        service: [
          new DidCommV1Service({
            id: `${theirDid};indy`,
            serviceEndpoint: 'https://endpoint.com',
            recipientKeys: [`${theirDid}#key-id`],
          }),
        ],
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
        imageUrl: connectionImageUrl,
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        senderKey: theirKey,
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
      })

      const outOfBand = getMockOutOfBand({
        did: 'fakeDid',
        mediatorId: 'fakeMediatorId',
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmfPPbuG8vajHvYjGUW8CN5k9rLuuMmYSGBYwJqJDDUS72')
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)
      expect(processedConnection.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a new connection record containing the information from the connection request when multiUseInvitation is enabled on the connection', async () => {
      expect.assertions(8)

      const connectionRecord = getMockConnection({
        id: 'test',
        state: DidExchangeState.InvitationSent,
        role: DidExchangeRole.Responder,
        multiUseInvitation: true,
      })

      const theirDid = 'their-did'
      const theirKey = Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519)
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [
          new EmbeddedAuthentication(
            new Ed25119Sig2018({
              id: `${theirDid}#key-id`,
              controller: theirDid,
              publicKeyBase58: theirKey.publicKeyBase58,
            })
          ),
        ],
        service: [
          new DidCommV1Service({
            id: `${theirDid};indy`,
            serviceEndpoint: 'https://endpoint.com',
            recipientKeys: [`${theirDid}#key-id`],
          }),
        ],
      })

      const connectionRequest = new ConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        connection: connectionRecord,
        senderKey: theirKey,
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
      })

      const outOfBand = getMockOutOfBand({
        did: 'fakeDid',
        mediatorId: 'fakeMediatorId',
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmfPPbuG8vajHvYjGUW8CN5k9rLuuMmYSGBYwJqJDDUS72')
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)

      expect(connectionRepository.save).toHaveBeenCalledTimes(1)
      expect(processedConnection.id).not.toBe(connectionRecord.id)
      expect(connectionRecord.id).toBe('test')
      expect(connectionRecord.state).toBe(DidExchangeState.InvitationSent)
    })

    it('throws an error when the message does not contain a did doc', async () => {
      expect.assertions(1)

      const connectionRequest = new ConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      const messageContext = new InboundMessageContext(connectionRequest, {
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
        senderKey: Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519),
      })

      const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Sender, state: OutOfBandState.AwaitResponse })

      return expect(connectionService.processRequest(messageContext, outOfBand)).rejects.toThrowError(
        `Public DIDs are not supported yet`
      )
    })

    it(`throws an error when out-of-band role is not ${OutOfBandRole.Sender}`, async () => {
      expect.assertions(1)

      const inboundMessage = new InboundMessageContext(jest.fn()(), {
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
        senderKey: Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519),
      })

      const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Receiver, state: OutOfBandState.AwaitResponse })

      return expect(connectionService.processRequest(inboundMessage, outOfBand)).rejects.toThrowError(
        `Invalid out-of-band record role ${OutOfBandRole.Receiver}, expected is ${OutOfBandRole.Sender}.`
      )
    })

    const invalidOutOfBandStates = [OutOfBandState.Initial, OutOfBandState.PrepareResponse, OutOfBandState.Done]
    test.each(invalidOutOfBandStates)(
      `throws an error when out-of-band state is %s and not ${OutOfBandState.AwaitResponse}`,
      (state) => {
        expect.assertions(1)

        const inboundMessage = new InboundMessageContext(jest.fn()(), {})
        const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Sender, state })

        return expect(connectionService.processRequest(inboundMessage, outOfBand)).rejects.toThrowError(
          `Invalid out-of-band record state ${state}, valid states are: ${OutOfBandState.AwaitResponse}.`
        )
      }
    )
  })

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      expect.assertions(2)

      // Needed for signing connection~sig
      const { did, verkey } = await wallet.createDid()
      const mockConnection = getMockConnection({
        state: DidExchangeState.RequestReceived,
        role: DidExchangeRole.Responder,
        tags: {
          threadId: 'test',
        },
      })

      const recipientKeys = [new DidKey(Key.fromPublicKeyBase58(verkey, KeyType.Ed25519))]
      const outOfBand = getMockOutOfBand({ did, recipientKeys: recipientKeys.map((did) => did.did) })
      const mockDidDoc = new DidDoc({
        id: did,
        publicKey: [
          new Ed25119Sig2018({
            id: `${did}#1`,
            controller: did,
            publicKeyBase58: verkey,
          }),
        ],
        authentication: [
          new EmbeddedAuthentication(
            new Ed25119Sig2018({
              id: `${did}#1`,
              controller: did,
              publicKeyBase58: verkey,
            })
          ),
        ],
        service: [
          new IndyAgentService({
            id: `${did}#IndyAgentService`,
            serviceEndpoint: 'http://example.com',
            recipientKeys: recipientKeys.map((did) => did.key.publicKeyBase58),
            routingKeys: [],
          }),
        ],
      })

      const { message, connectionRecord: connectionRecord } = await connectionService.createResponse(
        mockConnection,
        outOfBand
      )

      const connection = new Connection({
        did,
        didDoc: mockDidDoc,
      })
      const plainConnection = JsonTransformer.toJSON(connection)

      expect(connectionRecord.state).toBe(DidExchangeState.ResponseSent)
      expect(await unpackAndVerifySignatureDecorator(message.connectionSig, wallet)).toEqual(plainConnection)
    })

    it(`throws an error when connection role is ${DidExchangeRole.Requester} and not ${DidExchangeRole.Responder}`, async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        role: DidExchangeRole.Requester,
        state: DidExchangeState.RequestReceived,
      })
      const outOfBand = getMockOutOfBand()
      return expect(connectionService.createResponse(connection, outOfBand)).rejects.toThrowError(
        `Connection record has invalid role ${DidExchangeRole.Requester}. Expected role ${DidExchangeRole.Responder}.`
      )
    })

    const invalidOutOfBandStates = [
      DidExchangeState.InvitationSent,
      DidExchangeState.InvitationReceived,
      DidExchangeState.RequestSent,
      DidExchangeState.ResponseSent,
      DidExchangeState.ResponseReceived,
      DidExchangeState.Completed,
      DidExchangeState.Abandoned,
      DidExchangeState.Start,
    ]
    test.each(invalidOutOfBandStates)(
      `throws an error when connection state is %s and not ${DidExchangeState.RequestReceived}`,
      async (state) => {
        expect.assertions(1)

        const connection = getMockConnection({ state })
        const outOfBand = getMockOutOfBand()
        return expect(connectionService.createResponse(connection, outOfBand)).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${DidExchangeState.RequestReceived}.`
        )
      }
    )
  })

  describe('processResponse', () => {
    it('returns a connection record containing the information from the connection response', async () => {
      expect.assertions(2)

      const { did, verkey } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()

      const connectionRecord = getMockConnection({
        did,
        state: DidExchangeState.RequestSent,
        role: DidExchangeRole.Requester,
      })

      const theirKey = Key.fromPublicKeyBase58(theirVerkey, KeyType.Ed25519)

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [
            new EmbeddedAuthentication(
              new Ed25119Sig2018({
                id: `${theirDid}#key-id`,
                controller: theirDid,
                publicKeyBase58: theirKey.publicKeyBase58,
              })
            ),
          ],
          service: [
            new DidCommV1Service({
              id: `${did};indy`,
              serviceEndpoint: 'https://endpoint.com',
              recipientKeys: [`${theirDid}#key-id`],
            }),
          ],
        }),
      })

      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(theirKey).did],
      })
      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderKey: theirKey,
        recipientKey: Key.fromPublicKeyBase58(verkey, KeyType.Ed25519),
      })

      const processedConnection = await connectionService.processResponse(messageContext, outOfBandRecord)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const peerDid = didDocumentJsonToNumAlgo1Did(convertToNewDidDocument(otherPartyConnection.didDoc!).toJSON())

      expect(processedConnection.state).toBe(DidExchangeState.ResponseReceived)
      expect(processedConnection.theirDid).toBe(peerDid)
    })

    it(`throws an error when connection role is ${DidExchangeRole.Responder} and not ${DidExchangeRole.Requester}`, async () => {
      expect.assertions(1)

      const outOfBandRecord = getMockOutOfBand()
      const connectionRecord = getMockConnection({
        role: DidExchangeRole.Responder,
        state: DidExchangeState.RequestSent,
      })
      const messageContext = new InboundMessageContext(jest.fn()(), {
        connection: connectionRecord,
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
        senderKey: Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519),
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        `Connection record has invalid role ${DidExchangeRole.Responder}. Expected role ${DidExchangeRole.Requester}.`
      )
    })

    it('throws an error when the connection sig is not signed with the same key as the recipient key from the invitation', async () => {
      expect.assertions(1)

      const { did, verkey } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        role: DidExchangeRole.Requester,
        state: DidExchangeState.RequestSent,
      })

      const theirKey = Key.fromPublicKeyBase58(theirVerkey, KeyType.Ed25519)

      const otherPartyConnection = new Connection({
        did: theirDid,
        didDoc: new DidDoc({
          id: theirDid,
          publicKey: [],
          authentication: [
            new EmbeddedAuthentication(
              new Ed25119Sig2018({
                id: `${theirDid}#key-id`,
                controller: theirDid,
                publicKeyBase58: theirKey.publicKeyBase58,
              })
            ),
          ],
          service: [
            new DidCommV1Service({
              id: `${did};indy`,
              serviceEndpoint: 'https://endpoint.com',
              recipientKeys: [`${theirDid}#key-id`],
            }),
          ],
        }),
      })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      // Recipient key `verkey` is not the same as theirVerkey which was used to sign message,
      // therefore it should cause a failure.
      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)).did],
      })
      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        senderKey: theirKey,
        recipientKey: Key.fromPublicKeyBase58(verkey, KeyType.Ed25519),
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        new RegExp(
          'Connection object in connection response message is not signed with same key as recipient key in invitation'
        )
      )
    })

    it('throws an error when the message does not contain a DID Document', async () => {
      expect.assertions(1)

      const { did } = await wallet.createDid()
      const { did: theirDid, verkey: theirVerkey } = await wallet.createDid()
      const connectionRecord = getMockConnection({
        did,
        state: DidExchangeState.RequestSent,
        theirDid: undefined,
      })

      const theirKey = Key.fromPublicKeyBase58(theirVerkey, KeyType.Ed25519)

      const otherPartyConnection = new Connection({ did: theirDid })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(plainConnection, wallet, theirVerkey)

      const connectionResponse = new ConnectionResponseMessage({ threadId: uuid(), connectionSig })

      const outOfBandRecord = getMockOutOfBand({ recipientKeys: [new DidKey(theirKey).did] })
      const messageContext = new InboundMessageContext(connectionResponse, {
        connection: connectionRecord,
        recipientKey: Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519),
        senderKey: Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519),
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        `DID Document is missing.`
      )
    })
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({ state: DidExchangeState.ResponseReceived })

      const { message, connectionRecord: connectionRecord } = await connectionService.createTrustPing(mockConnection)

      expect(connectionRecord.state).toBe(DidExchangeState.Completed)
      expect(message).toEqual(expect.any(TrustPingMessage))
    })

    const invalidConnectionStates = [
      DidExchangeState.InvitationSent,
      DidExchangeState.InvitationReceived,
      DidExchangeState.RequestSent,
      DidExchangeState.RequestReceived,
      DidExchangeState.ResponseSent,
      DidExchangeState.Abandoned,
      DidExchangeState.Start,
    ]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${DidExchangeState.ResponseReceived} or ${DidExchangeState.Completed}`,
      (state) => {
        expect.assertions(1)
        const connection = getMockConnection({ state })

        return expect(connectionService.createTrustPing(connection)).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${DidExchangeState.ResponseReceived}, ${DidExchangeState.Completed}.`
        )
      }
    )
  })

  describe('processAck', () => {
    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, {})

      return expect(connectionService.processAck(messageContext)).rejects.toThrowError(
        'Unable to process connection ack: connection for recipient key undefined not found'
      )
    })

    it('updates the state to Completed when the state is ResponseSent and role is Responder', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: DidExchangeState.ResponseSent,
        role: DidExchangeRole.Responder,
      })

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, { connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidExchangeState.Completed)
    })

    it('does not update the state when the state is not ResponseSent or the role is not Responder', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: DidExchangeState.ResponseReceived,
        role: DidExchangeRole.Requester,
      })

      const ack = new AckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundMessageContext(ack, { connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidExchangeState.ResponseReceived)
    })
  })

  describe('assertConnectionOrServiceDecorator', () => {
    it('should not throw an error when a connection record with state complete is present in the messageContext', () => {
      expect.assertions(1)

      const messageContext = new InboundMessageContext(new AgentMessage(), {
        connection: getMockConnection({ state: DidExchangeState.Completed }),
      })

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).not.toThrow()
    })

    it('should throw an error when a connection record is present and state not complete in the messageContext', () => {
      expect.assertions(1)

      const messageContext = new InboundMessageContext(new AgentMessage(), {
        connection: getMockConnection({ state: DidExchangeState.InvitationReceived }),
      })

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).toThrowError(
        'Connection record is not ready to be used'
      )
    })

    it('should not throw an error when no connection record is present in the messageContext and no additional data, but the message has a ~service decorator', () => {
      expect.assertions(1)

      const message = new AgentMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundMessageContext(message)

      expect(() => connectionService.assertConnectionOrServiceDecorator(messageContext)).not.toThrow()
    })

    it('should not throw when a fully valid connection-less input is passed', () => {
      expect.assertions(1)

      const recipientKey = Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519)
      const senderKey = Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519)

      const previousSentMessage = new AgentMessage()
      previousSentMessage.setService({
        recipientKeys: [recipientKey.publicKeyBase58],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const previousReceivedMessage = new AgentMessage()
      previousReceivedMessage.setService({
        recipientKeys: [senderKey.publicKeyBase58],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new AgentMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundMessageContext(message, { recipientKey, senderKey })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
          previousSentMessage,
        })
      ).not.toThrow()
    })

    it('should throw an error when previousSentMessage is present, but recipientVerkey is not ', () => {
      expect.assertions(1)

      const previousSentMessage = new AgentMessage()
      previousSentMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new AgentMessage()
      const messageContext = new InboundMessageContext(message)

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousSentMessage,
        })
      ).toThrowError('Cannot verify service without recipientKey on incoming message')
    })

    it('should throw an error when previousSentMessage and recipientKey are present, but recipient key is not present in recipientKeys of previously sent message ~service decorator', () => {
      expect.assertions(1)

      const recipientKey = Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519)

      const previousSentMessage = new AgentMessage()
      previousSentMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new AgentMessage()
      const messageContext = new InboundMessageContext(message, { recipientKey })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousSentMessage,
        })
      ).toThrowError(
        'Previously sent message ~service recipientKeys does not include current received message recipient key'
      )
    })

    it('should throw an error when previousReceivedMessage is present, but senderVerkey is not ', () => {
      expect.assertions(1)

      const previousReceivedMessage = new AgentMessage()
      previousReceivedMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new AgentMessage()
      const messageContext = new InboundMessageContext(message)

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
        })
      ).toThrowError('Cannot verify service without senderKey on incoming message')
    })

    it('should throw an error when previousReceivedMessage and senderKey are present, but sender key is not present in recipientKeys of previously received message ~service decorator', () => {
      expect.assertions(1)

      const senderKey = 'senderKey'

      const previousReceivedMessage = new AgentMessage()
      previousReceivedMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new AgentMessage()
      const messageContext = new InboundMessageContext(message, {
        senderKey: Key.fromPublicKeyBase58(senderKey, KeyType.Ed25519),
      })

      expect(() =>
        connectionService.assertConnectionOrServiceDecorator(messageContext, {
          previousReceivedMessage,
        })
      ).toThrowError(
        'Previously received message ~service recipientKeys does not include current received message sender key'
      )
    })
  })

  describe('repository methods', () => {
    it('getById should return value from connectionRepository.getById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getById(expected.id)
      expect(connectionRepository.getById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('getByThreadId should return value from connectionRepository.getSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getByThreadId).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getByThreadId('threadId')
      expect(connectionRepository.getByThreadId).toBeCalledWith('threadId')

      expect(result).toBe(expected)
    })

    it('findById should return value from connectionRepository.findById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findById(expected.id)
      expect(connectionRepository.findById).toBeCalledWith(expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from connectionRepository.getAll', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getAll()
      expect(connectionRepository.getAll).toBeCalledWith()

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })
})
