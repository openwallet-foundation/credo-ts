import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../tests/types'
import type { AgentContext } from '../../../../../core/src/agent'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { Kms, TypedArrayEncoder } from '../../../../../core/src/index'
import { DidKey, IndyAgentService } from '../../../../../core/src/modules/dids'
import { DidDocumentRole } from '../../../../../core/src/modules/dids/domain/DidDocumentRole'
import { DidCommV1Service } from '../../../../../core/src/modules/dids/domain/service/DidCommV1Service'
import { didDocumentJsonToNumAlgo1Did } from '../../../../../core/src/modules/dids/methods/peer/peerDidNumAlgo1'
import { DidRecord, DidRepository } from '../../../../../core/src/modules/dids/repository'
import { indyDidFromPublicKeyBase58 } from '../../../../../core/src/utils/did'
import { JsonTransformer } from '../../../../../core/src/utils/JsonTransformer'
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
import { AckStatus, DidCommAckMessage } from '../../../messages'
import type { DidCommRouting } from '../../../models'
import { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRole } from '../../oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../oob/domain/DidCommOutOfBandState'
import { DidCommOutOfBandRepository } from '../../oob/repository/DidCommOutOfBandRepository'
import { DidCommConnectionRequestMessage, DidCommConnectionResponseMessage, DidCommTrustPingMessage } from '../messages'
import {
  authenticationTypes,
  DidCommConnection,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidDoc,
  Ed25119Sig2018,
  EmbeddedAuthentication,
  ReferencedAuthentication,
} from '../models'
import { DidCommConnectionRepository } from '../repository'
import { DidCommConnectionService } from '../services'
import { convertToNewDidDocument } from '../services/helpers'

vi.mock('../repository/DidCommConnectionRepository')
vi.mock('../../oob/repository/DidCommOutOfBandRepository')
vi.mock('../../oob/DidCommOutOfBandService')
vi.mock('../../../../../core/src/modules/dids/repository/DidRepository')
const ConnectionRepositoryMock = DidCommConnectionRepository as MockedClassConstructor<
  typeof DidCommConnectionRepository
>
const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const OutOfBandServiceMock = DidCommOutOfBandService as MockedClassConstructor<typeof DidCommOutOfBandService>
const DidRepositoryMock = DidRepository as MockedClassConstructor<typeof DidRepository>

const connectionImageUrl = 'https://example.com/image.png'

const endpoint = 'http://agent.com:8080'
const agentConfig = getAgentConfig('ConnectionServiceTest', {
  endpoints: [endpoint],
})

const outOfBandRepository = new OutOfBandRepositoryMock()
const outOfBandService = new OutOfBandServiceMock()
const didRepository = new DidRepositoryMock()

describe('DidCommConnectionService', () => {
  let connectionRepository: DidCommConnectionRepository

  let connectionService: DidCommConnectionService
  let eventEmitter: EventEmitter
  let myRouting: DidCommRouting
  let agentContext: AgentContext
  let kms: Kms.KeyManagementApi

  beforeAll(async () => {
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidCommOutOfBandRepository, outOfBandRepository],
        [DidCommOutOfBandService, outOfBandService],
        [DidRepository, didRepository],
        [DidCommModuleConfig, new DidCommModuleConfig({ endpoints: [endpoint] })],
      ],
    })
    kms = agentContext.resolve(Kms.KeyManagementApi)
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    connectionRepository = new ConnectionRepositoryMock()
    connectionService = new DidCommConnectionService(
      agentConfig.logger,
      connectionRepository,
      didRepository,
      eventEmitter
    )

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
      new DidRecord({
        did: 'did:peer:123',
        role: DidDocumentRole.Created,
      })
    )
    mockFunction(didRepository.findByQuery).mockResolvedValue([])
  })

  afterEach(() => {
    vitest.clearAllMocks()
  })

  describe('createRequest', () => {
    it('returns a connection request message containing the information from the connection record', async () => {
      expect.assertions(5)

      const outOfBand = getMockOutOfBand({ state: DidCommOutOfBandState.PrepareResponse })
      const config = { routing: myRouting, label: 'alice', imageUrl: connectionImageUrl }

      const { connectionRecord, message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(connectionRecord.state).toBe(DidCommDidExchangeState.RequestSent)
      expect(message.label).toBe('alice')
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

      const outOfBand = getMockOutOfBand({ state: DidCommOutOfBandState.PrepareResponse })
      const config = { label: 'Custom label', routing: myRouting }

      const { message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(message.label).toBe('Custom label')
    })

    it('returns a connection record containing image url', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: DidCommOutOfBandState.PrepareResponse, imageUrl: connectionImageUrl })
      const config = { label: 'Custom label', connectionImageUrl, routing: myRouting }

      const { connectionRecord } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(connectionRecord.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a connection request message containing a custom image url', async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state: DidCommOutOfBandState.PrepareResponse })
      const config = { imageUrl: 'custom-image-url', label: '', routing: myRouting }

      const { message } = await connectionService.createRequest(agentContext, outOfBand, config)

      expect(message.imageUrl).toBe('custom-image-url')
    })

    it(`throws an error when out-of-band role is not ${DidCommOutOfBandRole.Receiver}`, async () => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({
        role: DidCommOutOfBandRole.Sender,
        state: DidCommOutOfBandState.PrepareResponse,
      })
      const config = { label: '', routing: myRouting }

      return expect(connectionService.createRequest(agentContext, outOfBand, config)).rejects.toThrow(
        `Invalid out-of-band record role ${DidCommOutOfBandRole.Sender}, expected is ${DidCommOutOfBandRole.Receiver}.`
      )
    })

    const invalidConnectionStates = [
      DidCommOutOfBandState.Initial,
      DidCommOutOfBandState.AwaitResponse,
      DidCommOutOfBandState.Done,
    ]
    test.each(
      invalidConnectionStates
    )(`throws an error when out-of-band state is %s and not ${DidCommOutOfBandState.PrepareResponse}`, (state) => {
      expect.assertions(1)

      const outOfBand = getMockOutOfBand({ state })
      const config = { label: '', routing: myRouting }

      return expect(connectionService.createRequest(agentContext, outOfBand, config)).rejects.toThrow(
        `Invalid out-of-band record state ${state}, valid states are: ${DidCommOutOfBandState.PrepareResponse}.`
      )
    })
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

      const connectionRequest = new DidCommConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
        imageUrl: connectionImageUrl,
      })

      const messageContext = new DidCommInboundMessageContext(connectionRequest, {
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
        role: DidCommOutOfBandRole.Sender,
        state: DidCommOutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidCommDidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmcLh1CQfxn2rCN4xBkgjrozMJAdmHEchbjrzsxNPzXUZa')
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)
      expect(processedConnection.imageUrl).toBe(connectionImageUrl)
    })

    it('returns a new connection record containing the information from the connection request when multiUseInvitation is enabled on the connection', async () => {
      expect.assertions(8)

      const connectionRecord = getMockConnection({
        id: 'test',
        state: DidCommDidExchangeState.InvitationSent,
        role: DidCommDidExchangeRole.Responder,
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

      const connectionRequest = new DidCommConnectionRequestMessage({
        did: theirDid,
        didDoc: theirDidDoc,
        label: 'test-label',
      })

      const messageContext = new DidCommInboundMessageContext(connectionRequest, {
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
        role: DidCommOutOfBandRole.Sender,
        state: DidCommOutOfBandState.AwaitResponse,
      })
      const processedConnection = await connectionService.processRequest(messageContext, outOfBand)

      expect(processedConnection.state).toBe(DidCommDidExchangeState.RequestReceived)
      expect(processedConnection.theirDid).toBe('did:peer:1zQmcLh1CQfxn2rCN4xBkgjrozMJAdmHEchbjrzsxNPzXUZa')
      expect(processedConnection.theirLabel).toBe('test-label')
      expect(processedConnection.threadId).toBe(connectionRequest.id)

      expect(connectionRepository.save).toHaveBeenCalledTimes(1)
      expect(processedConnection.id).not.toBe(connectionRecord.id)
      expect(connectionRecord.id).toBe('test')
      expect(connectionRecord.state).toBe(DidCommDidExchangeState.InvitationSent)
    })

    it('throws an error when the message does not contain a did doc', async () => {
      expect.assertions(1)

      const connectionRequest = new DidCommConnectionRequestMessage({
        did: 'did',
        label: 'test-label',
      })

      const messageContext = new DidCommInboundMessageContext(connectionRequest, {
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

      const outOfBand = getMockOutOfBand({
        role: DidCommOutOfBandRole.Sender,
        state: DidCommOutOfBandState.AwaitResponse,
      })

      return expect(connectionService.processRequest(messageContext, outOfBand)).rejects.toThrow(
        'Public DIDs are not supported yet'
      )
    })

    it(`throws an error when out-of-band role is not ${DidCommOutOfBandRole.Sender}`, async () => {
      expect.assertions(1)

      const inboundMessage = new DidCommInboundMessageContext(vi.fn()(), {
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

      const outOfBand = getMockOutOfBand({
        role: DidCommOutOfBandRole.Receiver,
        state: DidCommOutOfBandState.AwaitResponse,
      })

      return expect(connectionService.processRequest(inboundMessage, outOfBand)).rejects.toThrow(
        `Invalid out-of-band record role ${DidCommOutOfBandRole.Receiver}, expected is ${DidCommOutOfBandRole.Sender}.`
      )
    })

    const invalidOutOfBandStates = [
      DidCommOutOfBandState.Initial,
      DidCommOutOfBandState.PrepareResponse,
      DidCommOutOfBandState.Done,
    ]
    test.each(
      invalidOutOfBandStates
    )(`throws an error when out-of-band state is %s and not ${DidCommOutOfBandState.AwaitResponse}`, (state) => {
      expect.assertions(1)

      const inboundMessage = new DidCommInboundMessageContext(vi.fn()(), { agentContext })
      const outOfBand = getMockOutOfBand({ role: DidCommOutOfBandRole.Sender, state })

      return expect(connectionService.processRequest(inboundMessage, outOfBand)).rejects.toThrow(
        `Invalid out-of-band record state ${state}, valid states are: ${DidCommOutOfBandState.AwaitResponse}.`
      )
    })
  })

  describe('createResponse', () => {
    it('returns a connection response message containing the information from the connection record', async () => {
      expect.assertions(2)

      const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
      const did = indyDidFromPublicKeyBase58(TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey))

      // Needed for signing connection~sig
      const mockConnection = getMockConnection({
        state: DidCommDidExchangeState.RequestReceived,
        role: DidCommDidExchangeRole.Responder,
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

      const connection = new DidCommConnection({
        did,
        didDoc: mockDidDoc,
      })
      const plainConnection = JsonTransformer.toJSON(connection)

      expect(connectionRecord.state).toBe(DidCommDidExchangeState.ResponseSent)
      expect(await unpackAndVerifySignatureDecorator(agentContext, message.connectionSig)).toEqual(plainConnection)
    })

    it(`throws an error when connection role is ${DidCommDidExchangeRole.Requester} and not ${DidCommDidExchangeRole.Responder}`, async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        role: DidCommDidExchangeRole.Requester,
        state: DidCommDidExchangeState.RequestReceived,
      })
      const outOfBand = getMockOutOfBand()
      return expect(connectionService.createResponse(agentContext, connection, outOfBand)).rejects.toThrow(
        `Connection record has invalid role ${DidCommDidExchangeRole.Requester}. Expected role ${DidCommDidExchangeRole.Responder}.`
      )
    })

    const invalidOutOfBandStates = [
      DidCommDidExchangeState.InvitationSent,
      DidCommDidExchangeState.InvitationReceived,
      DidCommDidExchangeState.RequestSent,
      DidCommDidExchangeState.ResponseSent,
      DidCommDidExchangeState.ResponseReceived,
      DidCommDidExchangeState.Completed,
      DidCommDidExchangeState.Abandoned,
      DidCommDidExchangeState.Start,
    ]
    test.each(
      invalidOutOfBandStates
    )(`throws an error when connection state is %s and not ${DidCommDidExchangeState.RequestReceived}`, async (state) => {
      expect.assertions(1)

      const connection = getMockConnection({ state })
      const outOfBand = getMockOutOfBand()
      return expect(connectionService.createResponse(agentContext, connection, outOfBand)).rejects.toThrow(
        `Connection record is in invalid state ${state}. Valid states are: ${DidCommDidExchangeState.RequestReceived}.`
      )
    })
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
        state: DidCommDidExchangeState.RequestSent,
        role: DidCommDidExchangeRole.Requester,
      })

      const otherPartyConnection = new DidCommConnection({
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

      const connectionResponse = new DidCommConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(theirPublicJwk).did],
      })
      const messageContext = new DidCommInboundMessageContext(connectionResponse, {
        agentContext,
        connection: connectionRecord,
        senderKey: theirPublicJwk,
        recipientKey: publicJwk,
      })

      const processedConnection = await connectionService.processResponse(messageContext, outOfBandRecord)

      const peerDid = didDocumentJsonToNumAlgo1Did(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        convertToNewDidDocument(otherPartyConnection.didDoc!).didDocument.toJSON()
      )

      expect(processedConnection.state).toBe(DidCommDidExchangeState.ResponseReceived)
      expect(processedConnection.theirDid).toBe(peerDid)
    })

    it(`throws an error when connection role is ${DidCommDidExchangeRole.Responder} and not ${DidCommDidExchangeRole.Requester}`, async () => {
      expect.assertions(1)

      const outOfBandRecord = getMockOutOfBand()
      const connectionRecord = getMockConnection({
        role: DidCommDidExchangeRole.Responder,
        state: DidCommDidExchangeState.RequestSent,
      })
      const messageContext = new DidCommInboundMessageContext(vi.fn()(), {
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

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrow(
        `Connection record has invalid role ${DidCommDidExchangeRole.Responder}. Expected role ${DidCommDidExchangeRole.Requester}.`
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
        role: DidCommDidExchangeRole.Requester,
        state: DidCommDidExchangeState.RequestSent,
      })

      const otherPartyConnection = new DidCommConnection({
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

      const connectionResponse = new DidCommConnectionResponseMessage({
        threadId: uuid(),
        connectionSig,
      })

      // Recipient key `verkey` is not the same as theirVerkey which was used to sign message,
      // therefore it should cause a failure.
      const outOfBandRecord = getMockOutOfBand({
        recipientKeys: [new DidKey(publicJwk).did],
      })
      const messageContext = new DidCommInboundMessageContext(connectionResponse, {
        agentContext,
        connection: connectionRecord,
        senderKey: theirPublicJwk,
        recipientKey: publicJwk,
      })

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrow(
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
        state: DidCommDidExchangeState.RequestSent,
        theirDid: undefined,
      })

      const otherPartyConnection = new DidCommConnection({ did: theirDid })
      const plainConnection = JsonTransformer.toJSON(otherPartyConnection)
      const connectionSig = await signData(agentContext, plainConnection, theirPublicJwk)

      const connectionResponse = new DidCommConnectionResponseMessage({ threadId: uuid(), connectionSig })

      const outOfBandRecord = getMockOutOfBand({ recipientKeys: [new DidKey(theirPublicJwk).did] })
      const messageContext = new DidCommInboundMessageContext(connectionResponse, {
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

      return expect(connectionService.processResponse(messageContext, outOfBandRecord)).rejects.toThrow(
        'DID Document is missing.'
      )
    })
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({ state: DidCommDidExchangeState.ResponseReceived })

      const { message, connectionRecord } = await connectionService.createTrustPing(agentContext, mockConnection)

      expect(connectionRecord.state).toBe(DidCommDidExchangeState.Completed)
      expect(message).toEqual(expect.any(DidCommTrustPingMessage))
    })

    const invalidConnectionStates = [
      DidCommDidExchangeState.InvitationSent,
      DidCommDidExchangeState.InvitationReceived,
      DidCommDidExchangeState.RequestSent,
      DidCommDidExchangeState.RequestReceived,
      DidCommDidExchangeState.ResponseSent,
      DidCommDidExchangeState.Abandoned,
      DidCommDidExchangeState.Start,
    ]
    test.each(
      invalidConnectionStates
    )(`throws an error when connection state is %s and not ${DidCommDidExchangeState.ResponseReceived} or ${DidCommDidExchangeState.Completed}`, (state) => {
      expect.assertions(1)
      const connection = getMockConnection({ state })

      return expect(connectionService.createTrustPing(agentContext, connection)).rejects.toThrow(
        `Connection record is in invalid state ${state}. Valid states are: ${DidCommDidExchangeState.ResponseReceived}, ${DidCommDidExchangeState.Completed}.`
      )
    })
  })

  describe('processAck', () => {
    it('throws an error when the message context does not have a connection', async () => {
      expect.assertions(1)

      const ack = new DidCommAckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new DidCommInboundMessageContext(ack, { agentContext })

      return expect(connectionService.processAck(messageContext)).rejects.toThrow(
        'Unable to process connection ack: connection for recipient key undefined not found'
      )
    })

    it('updates the state to Completed when the state is ResponseSent and role is Responder', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: DidCommDidExchangeState.ResponseSent,
        role: DidCommDidExchangeRole.Responder,
      })

      const ack = new DidCommAckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new DidCommInboundMessageContext(ack, { agentContext, connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidCommDidExchangeState.Completed)
    })

    it('does not update the state when the state is not ResponseSent or the role is not Responder', async () => {
      expect.assertions(1)

      const connection = getMockConnection({
        state: DidCommDidExchangeState.ResponseReceived,
        role: DidCommDidExchangeRole.Requester,
      })

      const ack = new DidCommAckMessage({
        status: AckStatus.OK,
        threadId: 'thread-id',
      })

      const messageContext = new DidCommInboundMessageContext(ack, { agentContext, connection })

      const updatedConnection = await connectionService.processAck(messageContext)

      expect(updatedConnection.state).toBe(DidCommDidExchangeState.ResponseReceived)
    })
  })

  describe('assertConnectionOrOutOfBandExchange', () => {
    it('should throw an error when a expectedConnectionId is present, but no connection is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
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

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.InvitationReceived, id: 'something' }),
      })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          expectedConnectionId: 'something-else',
        })
      ).rejects.toThrow('Expected incoming message to be from connection something-else but connection is something.')
    })

    it('should not throw an error when a connection record with state complete is present in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.Completed }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).resolves.not.toThrow()
    })

    it('should throw an error when a connection record is present and state not complete in the messageContext', async () => {
      expect.assertions(1)

      const messageContext = new DidCommInboundMessageContext(new DidCommMessage(), {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.InvitationReceived }),
      })

      await expect(connectionService.assertConnectionOrOutOfBandExchange(messageContext)).rejects.toThrow(
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
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

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
      const messageContext = new DidCommInboundMessageContext(message, { agentContext, recipientKey, senderKey })

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
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrow(
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
      const messageContext = new DidCommInboundMessageContext(message, { agentContext, recipientKey, senderKey })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastSentMessage,
        })
      ).rejects.toThrow('Recipient key z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th not found in our service')
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
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })

      await expect(
        connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
          lastReceivedMessage,
        })
      ).rejects.toThrow(
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
      const messageContext = new DidCommInboundMessageContext(message, {
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
      expect(connectionRepository.getById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getByThreadId should return value from connectionRepository.getSingleByQuery', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.getByThreadId).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getByThreadId(agentContext, 'threadId')
      expect(connectionRepository.getByThreadId).toHaveBeenCalledWith(agentContext, 'threadId')

      expect(result).toBe(expected)
    })

    it('findById should return value from connectionRepository.findById', async () => {
      const expected = getMockConnection()
      mockFunction(connectionRepository.findById).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findById(agentContext, expected.id)
      expect(connectionRepository.findById).toHaveBeenCalledWith(agentContext, expected.id)

      expect(result).toBe(expected)
    })

    it('getAll should return value from connectionRepository.getAll', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.getAll).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.getAll(agentContext)
      expect(connectionRepository.getAll).toHaveBeenCalledWith(agentContext)

      expect(result).toEqual(expect.arrayContaining(expected))
    })

    it('findAllByQuery should return value from connectionRepository.findByQuery', async () => {
      const expected = [getMockConnection(), getMockConnection()]

      mockFunction(connectionRepository.findByQuery).mockReturnValue(Promise.resolve(expected))
      const result = await connectionService.findAllByQuery(
        agentContext,
        {
          state: DidCommDidExchangeState.InvitationReceived,
        },
        undefined
      )
      expect(connectionRepository.findByQuery).toHaveBeenCalledWith(
        agentContext,
        {
          state: DidCommDidExchangeState.InvitationReceived,
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
