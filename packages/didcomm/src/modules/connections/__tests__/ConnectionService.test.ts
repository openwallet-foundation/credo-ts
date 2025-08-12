import type { AgentContext } from '../../../../../core/src/agent'
import type { DidCommRouting } from '../../../models'

import { Subject } from 'rxjs'

import { Kms, TypedArrayEncoder } from '../../../../../core'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { DidKey, IndyAgentService } from '../../../../../core/src/modules/dids'
import { DidDocumentRole } from '../../../../../core/src/modules/dids/domain/DidDocumentRole'
import { DidCommV1Service } from '../../../../../core/src/modules/dids/domain/service/DidCommV1Service'
import { didDocumentJsonToNumAlgo1Did } from '../../../../../core/src/modules/dids/methods/peer/peerDidNumAlgo1'
import { DidRecord, DidRepository } from '../../../../../core/src/modules/dids/repository'
import { JsonTransformer } from '../../../../../core/src/utils/JsonTransformer'
import { indyDidFromPublicKeyBase58 } from '../../../../../core/src/utils/did'
import { uuid } from '../../../../../core/src/utils/uuid'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  getMockOutOfBand,
  mockFunction,
} from '../../../../../core/tests/helpers'
import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { AckDidCommMessage, AckStatus } from '../../../messages'
import { InboundDidCommMessageContext } from '../../../models'
import { OutOfBandService } from '../../oob/OutOfBandService'
import { OutOfBandRole } from '../../oob/domain/OutOfBandRole'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { OutOfBandRepository } from '../../oob/repository/OutOfBandRepository'
import { ConnectionRequestMessage, ConnectionResponseMessage, TrustPingMessage } from '../messages'
import {
  Connection,
  DidDoc,
  DidExchangeRole,
  DidExchangeState,
  Ed25119Sig2018,
  EmbeddedAuthentication,
  ReferencedAuthentication,
  authenticationTypes,
} from '../models'
import { ConnectionRepository } from '../repository'
import { ConnectionService } from '../services'
import { convertToNewDidDocument } from '../services/helpers'

jest.mock('../repository/ConnectionRepository')
jest.mock('../../oob/repository/OutOfBandRepository')
jest.mock('../../oob/OutOfBandService')
jest.mock('../../../../../core/src/modules/dids/repository/DidRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>
const OutOfBandRepositoryMock = OutOfBandRepository as jest.Mock<OutOfBandRepository>
const OutOfBandServiceMock = OutOfBandService as jest.Mock<OutOfBandService>
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const connectionImageUrl = 'https://example.com/image.png'

const endpoint = 'http://agent.com:8080'
const agentConfig = getAgentConfig('ConnectionServiceTest', {
  endpoints: [endpoint],
  connectionImageUrl,
})

const outOfBandRepository = new OutOfBandRepositoryMock()
const outOfBandService = new OutOfBandServiceMock()
const didRepository = new DidRepositoryMock()

describe('ConnectionService', () => {
  let connectionRepository: ConnectionRepository

  let connectionService: ConnectionService
  let eventEmitter: EventEmitter
  let myRouting: DidCommRouting
  let agentContext: AgentContext
  let kms: Kms.KeyManagementApi

  beforeAll(async () => {
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [OutOfBandRepository, outOfBandRepository],
        [OutOfBandService, outOfBandService],
        [DidRepository, didRepository],
        [DidCommModuleConfig, new DidCommModuleConfig({ endpoints: [endpoint], connectionImageUrl })],
      ],
    })
    kms = agentContext.resolve(Kms.KeyManagementApi)
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    connectionRepository = new ConnectionRepositoryMock()
    connectionService = new ConnectionService(agentConfig.logger, connectionRepository, didRepository, eventEmitter)

    const recipientKey = Kms.PublicJwk.fromFingerprint(
      'z6MkwFkSP4uv5PhhKJCGehtjuZedkotC7VF64xtMsxuM8R3W'
    ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    recipientKey.keyId = 'something-random'

    myRouting = {
      recipientKey,
      endpoints: [endpoint],
      routingKeys: [],
      mediatorId: 'fakeMediatorId',
    }

    mockFunction(didRepository.getById).mockResolvedValue(
      Promise.resolve(
        new DidRecord({
          did: 'did:peer:123',
          role: DidDocumentRole.Created,
        })
      )
    )
    mockFunction(didRepository.findByQuery).mockResolvedValue(Promise.resolve([]))
  })

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(5)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse })
      const config = { routing: myRouting }

      const { connectionRecord, message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(connectionRecord.state).toBe(DidExchangeState.RequestSent)
      expect(message.label).toBe(agentConfig.label)
      expect(message.connection.did).toBe('XpwgBjsC2wh3eHcMW6ZRJT')

      const publicKey = new Ed25119Sig2018({
        id: 'XpwgBjsC2wh3eHcMW6ZRJT#1',
        controller: 'XpwgBjsC2wh3eHcMW6ZRJT',
        publicKeyBase58: 'HoVPnpfUjrDECoMZy8vu4U6dwEcLhbzjNwyS3gwLDCG8',
      })

      expect(message.connection.didDoc).toEqual(
        new DidDoc({
          id: 'XpwgBjsC2wh3eHcMW6ZRJT',
          publicKey: [publicKey],
          authentication: [new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)],

          service: [
            new IndyAgentService({
              id: 'XpwgBjsC2wh3eHcMW6ZRJT#IndyAgentService-1',
              serviceEndpoint: endpoint,
              recipientKeys: ['HoVPnpfUjrDECoMZy8vu4U6dwEcLhbzjNwyS3gwLDCG8'],
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

      const { message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(message.label).toBe('Custom label')
    })

    it('returns a connection record containing image url', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse, imageUrl: connectionImageUrl })
      const config = { label: 'Custom label', routing: myRouting }

      const { connectionRecord } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(connectionRecord.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a connection request message containing a custom image url', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: OutOfBandState.PrepareResponse })
      const config = { imageUrl: 'custom-image-url', routing: myRouting }

      const { message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(message.imageUrl).toBe('custom-image-url')
    })

    it(`throws an error when out-of-band role is not ${OutOfBandRole.Receiver}`, async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Sender, state: OutOfBandState.PrepareResponse })
      const config = { routing: myRouting }

      return expect(connectionService.createRequest(agentContext, outOfBand, config)).rejects.toThrowError(
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

        return expect(connectionService.createRequest(agentContext, outOfBand, config)).rejects.toThrowError(
          `Invalid out-of-band record state ${state}, valid states are: ${OutOfBandState.PrepareResponse}.`
        )
      }
    )
  })

  describe('processRequest', () => {
    it('returns a connection record containing the information from the connection request', async () => {
      expect.assertions(5)

      const theirDid = 'their-did'
      const theirKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
      })
      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [
          new EmbeddedAuthentication(
            new Ed25119Sig2018({
              id: `${theirDid}#key-id`,
              controller: theirDid,
              publicKeyBase58: TypedArrayEncoder.toBase58(theirKey.publicKey.publicKey),
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

      const messageContext = new InboundDidCommMessageContext(connectionRequest, {
        agentContext,
        senderKey: theirKey,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
      })

      const outOfBand = getMockOutOfBand({
        mediatorId: 'fakeMediatorId',
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmcLh1CQfxn2rCN4xBkgjrozMJAdmHEchbjrzsxNPzXUZa')
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
      })

      const theirDid = 'their-did'
      const theirKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
      })

      const theirDidDoc = new DidDoc({
        id: theirDid,
        publicKey: [],
        authentication: [
          new EmbeddedAuthentication(
            new Ed25119Sig2018({
              id: `${theirDid}#key-id`,
              controller: theirDid,
              publicKeyBase58: TypedArrayEncoder.toBase58(theirKey.publicKey.publicKey),
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

      const messageContext = new InboundDidCommMessageContext(connectionRequest, {
        agentContext,
        connection: connectionRecord,
        senderKey: theirKey,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
      })

      const outOfBand = getMockOutOfBand({
        mediatorId: 'fakeMediatorId',
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmcLh1CQfxn2rCN4xBkgjrozMJAdmHEchbjrzsxNPzXUZa')
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

      const messageContext = new InboundDidCommMessageContext(connectionRequest, {
        agentContext,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
        }),
      })

      const outOfBand = getMockOutOfBand({ role: OutOfBandRole.Sender, state: OutOfBandState.AwaitResponse })

      return expect(connectionService.processRequest(messageContext, outOfBand)).rejects.toThrowError(
        'Public DIDs are not supported yet'
      )
    })

    it(`throws an error when out-of-band role is not ${OutOfBandRole.Sender}`, async () => {
      expect.assertions(1)

      const inboundMessage = new InboundDidCommMessageContext(jest.fn()(), {
        agentContext,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
        }),
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

        const inboundMessage = new InboundDidCommMessageContext(jest.fn()(), { agentContext })
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

      const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
      const did = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey))

      // Needed for signing connection~sig
      const mockConnection = getMockConnection({
        state: DidExchangeState.RequestReceived,
        role: DidExchangeRole.Responder,
        tags: {
          threadId: 'test',
        },
      })

      const recipientKeys = [new DidKey(publicJwk)]
      const outOfBand = getMockOutOfBand({
        recipientKeys: recipientKeys.map((did) => did.did),
        invitationInlineServiceKeys: [{ kmsKeyId: key.keyId, recipientKeyFingerprint: publicJwk.fingerprint }],
      })

      const publicKey = new Ed25119Sig2018({
        id: `${did}#1`,
        controller: did,
        publicKeyBase58: TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey),
      })
      const mockDidDoc = new DidDoc({
        id: did,
        publicKey: [publicKey],
        authentication: [new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)],
        service: [
          new IndyAgentService({
            id: `${did}#IndyAgentService-1`,
            serviceEndpoint: 'http://example.com',
            recipientKeys: recipientKeys.map((did) => {
              const publicKey = did.publicJwk.publicKey
              if (publicKey.kty !== 'OKP') throw new Error('expected okp')
              return TypedArrayEncoder.toBase58(publicKey.publicKey)
            }),
            routingKeys: [],
          }),
        ],
      })

      const { message, connectionRecord } = await connectionService.createResponse(
        agentContext,
        mockConnection,
        outOfBand
      )

      const connection = new Connection({
        did,
        didDoc: mockDidDoc,
      })
      const plainConnection = JsonTransformer.toJSON(connection)

      expect(connectionRecord.state).toBe(DidExchangeState.ResponseSent)
      expect(await unpackAndVerifySignatureDecorator(agentContext, message.connectionSig)).toEqual(plainConnection)
    })

    it(`throws an error when connection role is ${DidExchangeRole.Requester} and not ${DidExchangeRole.Responder}`, async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        role: DidExchangeRole.Requester,
        state: DidExchangeState.RequestReceived,
      })
      const outOfBand = getMockOutOfBand()
      return expect(connectionService.createResponse(agentContext, connection, outOfBand)).rejects.toThrowError(
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
        return expect(connectionService.createResponse(agentContext, connection, outOfBand)).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${DidExchangeState.RequestReceived}.`
        )
      }
    )
  })

  describe('processResponse', () => {
    it('returns a connection record containing the information from the connection response', async () => {
      expect.assertions(2)

      const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
      const did = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey))

      const theirKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const theirPublicJwk = Kms.PublicJwk.fromPublicJwk(theirKey.publicJwk)
      const theirDid = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(theirPublicJwk.publicKey.publicKey))

      const connectionRecord = getMockConnection({
        did,
        state: DidExchangeState.RequestSent,
        role: DidExchangeRole.Requester,
      })

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
                publicKeyBase58: TypedArrayEncoder.toBase58(theirPublicJwk.publicKey.publicKey),
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
      const connectionSig = await signData(agentContext, plainConnection, theirPublicJwk)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(theirPublicJwk).did],
      })
      const messageContext = new InboundDidCommMessageContext(connectionResponse, {
        agentContext,
        connection: connectionRecord,
        senderKey: theirPublicJwk,
        recipientKey: publicJwk,
      })

      const processedConnection = await connectionService.processResponse(messageContext, outOfBandRecord)

      const peerDid = didDocumentJsonToNumAlgo1Did(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        convertToNewDidDocument(otherPartyConnection.didDoc!).didDocument.toJSON()
      )

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
      const messageContext = new InboundDidCommMessageContext(jest.fn()(), {
        agentContext,
        connection: connectionRecord,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
        }),
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        `Connection record has invalid role ${DidExchangeRole.Responder}. Expected role ${DidExchangeRole.Requester}.`
      )
    })

    it('throws an error when the connection sig is not signed with the same key as the recipient key from the invitation', async () => {
      expect.assertions(1)

      const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
      const did = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey))

      const theirKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const theirPublicJwk = Kms.PublicJwk.fromPublicJwk(theirKey.publicJwk)
      const theirDid = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(theirPublicJwk.publicKey.publicKey))
      const connectionRecord = getMockConnection({
        did,
        role: DidExchangeRole.Requester,
        state: DidExchangeState.RequestSent,
      })

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
                publicKeyBase58: TypedArrayEncoder.toBase58(theirPublicJwk.publicKey.publicKey),
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
      const connectionSig = await signData(agentContext, plainConnection, theirPublicJwk)

      const connectionResponse = new ConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      // Recipient key `verkey` is not the same as theirVerkey which was used to sign message,
      // therefore it should cause a failure.
      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(publicJwk).did],
      })
      const messageContext = new InboundDidCommMessageContext(connectionResponse, {
        agentContext,
        connection: connectionRecord,
        senderKey: theirPublicJwk,
        recipientKey: publicJwk,
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        /Connection object in connection response message is not signed with same key as recipient key in invitation/
      )
    })

    it('throws an error when the message does not contain a DID Document', async () => {
      expect.assertions(1)

      const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
      const did = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey))

      const theirKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const theirPublicJwk = Kms.PublicJwk.fromPublicJwk(theirKey.publicJwk)
      const theirDid = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(theirPublicJwk.publicKey.publicKey))
      const connectionRecord = getMockConnection({
        did,
        state: DidExchangeState.RequestSent,
        theirDid: undefined,
      })

      const otherPartyConnection = new Connection({ did: theirDid })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(agentContext, plainConnection, theirPublicJwk)

      const connectionResponse = new ConnectionResponseMessage({ threadId: uuid(), connectionSig })

      const outOfBandRecord = getMockOutOfBand({ recipientKeys: [new DidKey(theirPublicJwk).did] })
      const messageContext = new InboundDidCommMessageContext(connectionResponse, {
        agentContext,
        connection: connectionRecord,
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
        }),
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
        }),
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrowError(
        'DID Document is missing.'
      )
    })
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({ state: DidExchangeState.ResponseReceived })

      const { message, connectionRecord } = await connectionService.createTrustPing(agentContext, mockConnection)

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

        return expect(connectionService.createTrustPing(agentContext, connection)).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${DidExchangeState.ResponseReceived}, ${DidExchangeState.Completed}.`
        )
      }
    )
  })

  describe('processAck', () => {
    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const ack = new AckDidCommMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundDidCommMessageContext(ack, { agentContext })

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

      const ack = new AckDidCommMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundDidCommMessageContext(ack, { agentContext, connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidExchangeState.Completed)
    })

    it('does not update the state when the state is not ResponseSent or the role is not Responder', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: DidExchangeState.ResponseReceived,
        role: DidExchangeRole.Requester,
      })

      const ack = new AckDidCommMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new InboundDidCommMessageContext(ack, { agentContext, connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidExchangeState.ResponseReceived)
    })
  })

  describe('assertConnectionOrOutOfBandExchange', () => {
    it('should throw an error when a expectedConnectionId is present, but no connection is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new InboundDidCommMessageContext(new DidCommMessage(), {
        agentContext,
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          expectedConnectionId: '123',
        })
      ).rejects.toThrow('Expected incoming message to be from connection 123 but no connection found.')
    })

    it('should throw an error when a expectedConnectionId is present, but does not match with connection id present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new InboundDidCommMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidExchangeState.InvitationReceived, id: 'something' }),
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          expectedConnectionId: 'something-else',
        })
      ).rejects.toThrow('Expected incoming message to be from connection something-else but connection is something.')
    })

    it('should not throw an error when a connection record with state complete is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new InboundDidCommMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidExchangeState.Completed }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).resolves.not.toThrow()
    })

    it('should throw an error when a connection record is present and state not complete in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new InboundDidCommMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidExchangeState.InvitationReceived }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).rejects.toThrowError(
        'Connection record is not ready to be used'
      )
    })

    it('should not throw an error when no connection record is present in the messageContext and no additional data, but the message has a ~service decorator', async () => {
      expect.assertions(1)

      mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundDidCommMessageContext(message, { agentContext })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).resolves.not.toThrow()
    })

    it('should not throw when a fully valid connection-less input is passed', async () => {
      expect.assertions(1)

      const recipientKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })
      const senderKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(recipientKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(senderKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [TypedArrayEncoder.toBase58(senderKey.publicKey.publicKey)],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundDidCommMessageContext(message, { agentContext, recipientKey, senderKey })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
          lastSentMessage,
        })
      ).resolves.not.toThrow()
    })

    it('should throw an error when lastSentMessage is present, but recipientVerkey is not ', async () => {
      expect.assertions(1)

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundDidCommMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrowError(
        'Incoming message must have recipientKey and senderKey (so cannot be AuthCrypt or unpacked) if there are lastSentMessage or lastReceivedMessage.'
      )
    })

    it('should throw an error when lastSentMessage and recipientKey are present, but recipient key is not present in recipientKeys of previously sent message ~service decorator', async () => {
      expect.assertions(1)

      const recipientKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })
      const senderKey = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      message.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })
      const messageContext = new InboundDidCommMessageContext(message, { agentContext, recipientKey, senderKey })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrowError('Recipient key z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th not found in our service')
    })

    it('should throw an error when lastReceivedMessage is present, but senderVerkey is not ', async () => {
      expect.assertions(1)

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: [],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      const messageContext = new InboundDidCommMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
        })
      ).rejects.toThrowError(
        'No keys on our side to use for encrypting messages, and previous messages found (in which case our keys MUST also be present).'
      )
    })

    it('should throw an error when lastReceivedMessage and senderKey are present, but sender key is not present in recipientKeys of previously received message ~service decorator', async () => {
      expect.assertions(1)

      const senderKey = 'senderKey'

      const lastReceivedMessage = new DidCommMessage()
      lastReceivedMessage.setService({
        recipientKeys: ['anotherKey'],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const lastSentMessage = new DidCommMessage()
      lastSentMessage.setService({
        recipientKeys: [senderKey],
        serviceEndpoint: '',
        routingKeys: [],
      })

      const message = new DidCommMessage()
      const messageContext = new InboundDidCommMessageContext(message, {
        agentContext,
        senderKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58('randomKey'),
        }),
        recipientKey: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58(senderKey),
        }),
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
          lastSentMessage,
        })
      ).rejects.toThrow('Sender key z41yMxWDBqGD2Z not found in their service.')
    })
  })

  describe('repository methods', () => {
    it('getById should return value from connectionRepository.getById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getById(agentContext, expected.id)
      expect(connectionRepository.getById).toBeCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getByThreadId should return value from connectionRepository.getSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getByThreadId).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getByThreadId(agentContext, 'threadId')
      expect(connectionRepository.getByThreadId).toBeCalledWith(agentContext, 'threadId')

      expect(result).toBe(expected)
    })

    it('findById should return value from connectionRepository.findById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findById(agentContext, expected.id)
      expect(connectionRepository.findById).toBeCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from connectionRepository.getAll', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getAll(agentContext)
      expect(connectionRepository.getAll).toBeCalledWith(agentContext)

      expect(result).toEqual(expect.arrayContaining(expected))
    })

    it('findAllByQuery should return value from connectionRepository.findByQuery', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.findByQuery).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findAllByQuery(
        agentContext,
        {
          state: DidExchangeState.InvitationReceived,
        },
        undefined
      )
      expect(connectionRepository.findByQuery).toBeCalledWith(
        agentContext,
        {
          state: DidExchangeState.InvitationReceived,
        },
        undefined
      )

      expect(result).toEqual(expect.arrayContaining(expected))
    })
  })

  describe('connectionType', () => {
    it('addConnectionType', async () => {
      const connection = getMockConnection()

      await connectionService.addConnectionType(agentContext, connection, 'type-1')
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject(['type-1'])

      await connectionService.addConnectionType(agentContext, connection, 'type-2')
      await connectionService.addConnectionType(agentContext, connection, 'type-3')

      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())
    })

    it('removeConnectionType - existing type', async () => {
      const connection = getMockConnection()
      connection.connectionTypes = ['type-1', 'type-2', 'type-3']
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())

      await connectionService.removeConnectionType(agentContext, connection, 'type-2')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-3'].sort())
    })

    it('removeConnectionType - type not existent', async () => {
      const connection = getMockConnection()
      connection.connectionTypes = ['type-1', 'type-2', 'type-3']
      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject(['type-1', 'type-2', 'type-3'])

      await connectionService.removeConnectionType(agentContext, connection, 'type-4')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes.sort()).toMatchObject(['type-1', 'type-2', 'type-3'].sort())
    })

    it('removeConnectionType - no previous types', async () => {
      const connection = getMockConnection()

      let connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject([])

      await connectionService.removeConnectionType(agentContext, connection, 'type-4')
      connectionTypes = await connectionService.getConnectionTypes(connection)
      expect(connectionTypes).toMatchObject([])
    })
  })
})
