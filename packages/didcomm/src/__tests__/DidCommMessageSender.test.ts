import type { DidDocumentService, IndyAgentService } from '../../../core/src/modules/dids'
import type { ResolvedDidCommService } from '../../../core/src/types'
import type { DidCommMessageSentEvent } from '../DidCommEvents'
import type { DidCommConnectionRecord } from '../modules'
import { InMemoryQueueTransportRepository, type DidCommOutboundTransport } from '../transport'
import type { DidCommEncryptedMessage } from '../types'

import { Subject } from 'rxjs'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { DidDocument, VerificationMethod } from '../../../core/src/modules/dids'
import { DidsApi } from '../../../core/src/modules/dids/DidsApi'
import { DidCommV1Service } from '../../../core/src/modules/dids/domain/service/DidCommV1Service'
import { verkeyToPublicJwk } from '../../../core/src/modules/dids/helpers'
import { TestMessage } from '../../../core/tests/TestMessage'
import {
  agentDependencies,
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../core/tests/helpers'
import { DidCommEnvelopeService as EnvelopeServiceImpl } from '../DidCommEnvelopeService'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommMessageSender } from '../DidCommMessageSender'
import { DidCommTransportService } from '../DidCommTransportService'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { DidCommOutboundMessageContext, OutboundMessageSendStatus } from '../models'
import { DidCommDocumentService } from '../services/DidCommDocumentService'

import { AgentConfig, Kms, TypedArrayEncoder } from '../../../core'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { DummyTransportSession } from './stubs'

jest.mock('../DidCommTransportService')
jest.mock('../DidCommEnvelopeService')
jest.mock('../../../core/src/modules/dids/DidsApi')
jest.mock('../services/DidCommDocumentService')

const TransportServiceMock = DidCommTransportService as jest.MockedClass<typeof DidCommTransportService>
const DidsApiMock = DidsApi as jest.Mock<DidsApi>
const DidCommDocumentServiceMock = DidCommDocumentService as jest.Mock<DidCommDocumentService>

class DummyHttpOutboundTransport implements DidCommOutboundTransport {
  public start(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public stop(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public supportedSchemes: string[] = ['https']

  public sendMessage() {
    return Promise.resolve()
  }
}

class DummyWsOutboundTransport implements DidCommOutboundTransport {
  public start(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public stop(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public supportedSchemes: string[] = ['wss']

  public sendMessage() {
    return Promise.resolve()
  }
}

describe('DidCommMessageSender', () => {
  const DidCommEnvelopeService = <jest.Mock<EnvelopeServiceImpl>>(<unknown>EnvelopeServiceImpl)

  const encryptedMessage: DidCommEncryptedMessage = {
    protected: 'base64url',
    iv: 'base64url',
    ciphertext: 'base64url',
    tag: 'base64url',
  }

  const enveloperService = new DidCommEnvelopeService()
  const envelopeServicePackMessageMock = mockFunction(enveloperService.packMessage)

  const didsApi = new DidsApiMock()
  const didCommDocumentService = new DidCommDocumentServiceMock()
  const eventEmitter = new EventEmitter(agentDependencies, new Subject())
  const resolveCreatedDidDocumentWithKeysMock = mockFunction(didsApi.resolveCreatedDidDocumentWithKeys)
  const didResolverServiceResolveDidServicesMock = mockFunction(didCommDocumentService.resolveServicesFromDid)

  const inboundMessage = new TestMessage()
  inboundMessage.setReturnRouting(ReturnRouteTypes.all)

  const recipientKey = Kms.PublicJwk.fromPublicKey({
    crv: 'Ed25519',
    kty: 'OKP',
    publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
  })
  const senderKey = Kms.PublicJwk.fromPublicKey({
    crv: 'Ed25519',
    kty: 'OKP',
    publicKey: TypedArrayEncoder.fromBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'),
  })

  const session = new DummyTransportSession('session-123')
  session.keys = {
    recipientKeys: [recipientKey],
    routingKeys: [],
    senderKey: senderKey,
  }
  session.inboundMessage = inboundMessage
  session.send = jest.fn()

  const sessionWithoutKeys = new DummyTransportSession('sessionWithoutKeys-123')
  sessionWithoutKeys.inboundMessage = inboundMessage
  sessionWithoutKeys.send = jest.fn()

  const transportService = new DidCommTransportService(getAgentContext(), eventEmitter)
  const transportServiceFindSessionMock = mockFunction(transportService.findSessionByConnectionId)
  const transportServiceFindSessionByIdMock = mockFunction(transportService.findSessionById)
  const transportServiceHasInboundEndpoint = mockFunction(transportService.hasInboundEndpoint)

  const firstDidCommService = new DidCommV1Service({
    id: '<did>;indy',
    serviceEndpoint: 'https://www.first-endpoint.com',
    recipientKeys: ['#authentication-1'],
  })
  const secondDidCommService = new DidCommV1Service({
    id: '<did>;indy',
    serviceEndpoint: 'https://www.second-endpoint.com',
    recipientKeys: ['#authentication-1'],
  })

  let messageSender: DidCommMessageSender
  let outboundTransport: DidCommOutboundTransport
  let connection: DidCommConnectionRecord
  let outboundMessageContext: DidCommOutboundMessageContext
  const agentConfig = getAgentConfig('DidCommMessageSender')
  const agentContext = getAgentContext({
    registerInstances: [
      [DidsApi, didsApi],
      [AgentConfig, agentConfig],
    ],
  })
  const eventListenerMock = jest.fn()

  describe('sendMessage', () => {
    beforeEach(() => {
      TransportServiceMock.mockClear()
      DidsApiMock.mockClear()

      eventEmitter.on<DidCommMessageSentEvent>(DidCommEventTypes.DidCommMessageSent, eventListenerMock)

      outboundTransport = new DummyHttpOutboundTransport()
      messageSender = new DidCommMessageSender(
        enveloperService,
        transportService,
        new DidCommModuleConfig({ queueTransportRepository: new InMemoryQueueTransportRepository() }),
        didCommDocumentService,
        eventEmitter
      )
      connection = getMockConnection({
        id: 'test-123',
        did: 'did:peer:1mydid',
        theirDid: 'did:peer:1theirdid',
        theirLabel: 'Test 123',
      })
      outboundMessageContext = new DidCommOutboundMessageContext(new TestMessage(), { agentContext, connection })

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
      transportServiceHasInboundEndpoint.mockReturnValue(true)

      const didDocumentInstance = getMockDidDocument({
        service: [firstDidCommService, secondDidCommService],
      })
      resolveCreatedDidDocumentWithKeysMock.mockResolvedValue({
        didDocument: didDocumentInstance,
        keys: [],
      })
      didResolverServiceResolveDidServicesMock.mockResolvedValue([
        getMockResolvedDidService(firstDidCommService),
        getMockResolvedDidService(secondDidCommService),
      ])
    })

    afterEach(() => {
      eventEmitter.off<DidCommMessageSentEvent>(DidCommEventTypes.DidCommMessageSent, eventListenerMock)

      jest.resetAllMocks()
    })

    test('throw error when there is no outbound transport', async () => {
      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        /Message is undeliverable to connection/
      )
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })

    test('throw error when there is no service or queue', async () => {
      messageSender.registerOutboundTransport(outboundTransport)

      resolveCreatedDidDocumentWithKeysMock.mockResolvedValue({
        didDocument: getMockDidDocument({ service: [] }),
        keys: [],
      })
      didResolverServiceResolveDidServicesMock.mockResolvedValue([])

      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        'Message is undeliverable to connection test-123 (Test 123)'
      )
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })

    test('call send message when session send method fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(session)
      session.send = jest.fn().mockRejectedValue(new Error('some error'))

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connectionId: 'test-123',
        payload: encryptedMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test("resolves the did service using the did resolver if connection.theirDid starts with 'did:'", async () => {
      messageSender.registerOutboundTransport(outboundTransport)

      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      expect(didResolverServiceResolveDidServicesMock).toHaveBeenCalledWith(agentContext, connection.theirDid)
      expect(sendMessageSpy).toHaveBeenCalledWith({
        connectionId: 'test-123',
        payload: encryptedMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test("throws an error if connection.theirDid starts with 'did:' but the resolver can't resolve the did document", async () => {
      messageSender.registerOutboundTransport(outboundTransport)

      resolveCreatedDidDocumentWithKeysMock.mockRejectedValue(
        new Error(`Unable to resolve did document for did '${connection.theirDid}': notFound`)
      )

      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        `Unable to send message using connection 'test-123'. Unble to resolve did`
      )

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })

    test('call send message when session send method fails with missing keys', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(sessionWithoutKeys)

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connectionId: 'test-123',
        payload: encryptedMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('call send message on session when outbound message has sessionId attached', async () => {
      transportServiceFindSessionByIdMock.mockReturnValue(session)
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      // @ts-ignore
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'sendMessageToService')

      const contextWithSessionId = new DidCommOutboundMessageContext(outboundMessageContext.message, {
        agentContext: outboundMessageContext.agentContext,
        connection: outboundMessageContext.connection,
        sessionId: 'session-123',
      })

      await messageSender.sendMessage(contextWithSessionId)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: contextWithSessionId,
          status: OutboundMessageSendStatus.SentToSession,
        },
      })

      expect(session.send).toHaveBeenCalledTimes(1)
      expect(session.send).toHaveBeenNthCalledWith(1, agentContext, encryptedMessage)
      expect(sendMessageSpy).toHaveBeenCalledTimes(0)
      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(0)
      expect(transportServiceFindSessionByIdMock).toHaveBeenCalledWith('session-123')
    })

    test('call send message on session when there is a session for a given connection', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      //@ts-ignore
      const sendToServiceSpy = jest.spyOn(messageSender, 'sendToService')

      await messageSender.sendMessage(outboundMessageContext)

      //@ts-ignore
      const [[sendMessage]] = sendToServiceSpy.mock.calls

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })
      expect(sendMessage).toMatchObject({
        connection: {
          id: 'test-123',
        },
        message: outboundMessageContext.message,
        serviceParams: {
          returnRoute: false,
          service: {
            serviceEndpoint: firstDidCommService.serviceEndpoint,
          },
        },
      })

      //@ts-ignore
      expect(sendMessage.serviceParams.senderKey.fingerprint).toEqual(
        'z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1'
      )

      //@ts-ignore
      expect(sendMessage.serviceParams.service.recipientKeys.map((key) => key.fingerprint)).toEqual([
        'z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1',
      ])

      expect(sendToServiceSpy).toHaveBeenCalledTimes(1)
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('calls sendToService with payload and endpoint from second DidComm service when the first fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      //@ts-ignore
      const sendToServiceSpy = jest.spyOn(messageSender, 'sendToService')

      // Simulate the case when the first call fails
      sendMessageSpy.mockRejectedValueOnce(new Error())

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      //@ts-ignore
      const [, [sendMessage]] = sendToServiceSpy.mock.calls

      expect(sendMessage).toMatchObject({
        agentContext,
        connection: {
          id: 'test-123',
        },
        message: outboundMessageContext.message,
        serviceParams: {
          returnRoute: false,
          service: {
            serviceEndpoint: secondDidCommService.serviceEndpoint,
          },
        },
      })

      //@ts-ignore
      expect(sendMessage.serviceParams.senderKey.fingerprint).toEqual(
        'z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1'
      )
      //@ts-ignore
      expect(sendMessage.serviceParams.service.recipientKeys.map((key) => key.fingerprint)).toEqual([
        'z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1',
      ])

      expect(sendToServiceSpy).toHaveBeenCalledTimes(2)
      expect(sendMessageSpy).toHaveBeenCalledTimes(2)
    })

    test('throw error when message endpoint is not supported by outbound transport schemes', async () => {
      messageSender.registerOutboundTransport(new DummyWsOutboundTransport())
      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        /Message is undeliverable to connection/
      )

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })
  })

  describe('sendMessageToService', () => {
    const service: ResolvedDidCommService = {
      id: 'out-of-band',
      recipientKeys: [
        Kms.PublicJwk.fromPublicKey({
          crv: 'Ed25519',
          kty: 'OKP',
          publicKey: TypedArrayEncoder.fromBase58('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'),
        }),
      ],
      routingKeys: [],
      serviceEndpoint: 'https://example.com',
    }
    const senderKey = Kms.PublicJwk.fromPublicKey({
      crv: 'Ed25519',
      kty: 'OKP',
      publicKey: TypedArrayEncoder.fromBase58('z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'),
    })

    beforeEach(() => {
      outboundTransport = new DummyHttpOutboundTransport()
      messageSender = new DidCommMessageSender(
        enveloperService,
        transportService,
        new DidCommModuleConfig({ queueTransportRepository: new InMemoryQueueTransportRepository() }),
        didCommDocumentService,
        eventEmitter
      )

      eventEmitter.on<DidCommMessageSentEvent>(DidCommEventTypes.DidCommMessageSent, eventListenerMock)

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
    })

    afterEach(() => {
      jest.resetAllMocks()
      eventEmitter.off<DidCommMessageSentEvent>(DidCommEventTypes.DidCommMessageSent, eventListenerMock)
    })

    test('throws error when there is no outbound transport', async () => {
      outboundMessageContext = new DidCommOutboundMessageContext(new TestMessage(), {
        agentContext,
        serviceParams: {
          senderKey,
          service,
        },
      })
      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        'Agent has no outbound transport!'
      )

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })

    test('calls send message with payload and endpoint from DIDComm service', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      outboundMessageContext = new DidCommOutboundMessageContext(new TestMessage(), {
        agentContext,
        serviceParams: {
          senderKey,
          service,
        },
      })

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      expect(sendMessageSpy).toHaveBeenCalledWith({
        payload: encryptedMessage,
        endpoint: service.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('call send message with responseRequested when message has return route', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      const message = new TestMessage()
      message.setReturnRouting(ReturnRouteTypes.all)

      outboundMessageContext = new DidCommOutboundMessageContext(message, {
        agentContext,
        serviceParams: {
          senderKey,
          service,
        },
      })

      await messageSender.sendMessage(outboundMessageContext)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.SentToTransport,
        },
      })

      expect(sendMessageSpy).toHaveBeenCalledWith({
        payload: encryptedMessage,
        endpoint: service.serviceEndpoint,
        responseRequested: true,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('throw error when message endpoint is not supported by outbound transport schemes', async () => {
      messageSender.registerOutboundTransport(new DummyWsOutboundTransport())
      outboundMessageContext = new DidCommOutboundMessageContext(new TestMessage(), {
        agentContext,
        serviceParams: {
          senderKey,
          service,
        },
      })

      await expect(messageSender.sendMessage(outboundMessageContext)).rejects.toThrow(
        /Unable to send message to service/
      )
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: DidCommEventTypes.DidCommMessageSent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          message: outboundMessageContext,
          status: OutboundMessageSendStatus.Undeliverable,
        },
      })
    })
  })

  describe('packMessage', () => {
    beforeEach(() => {
      outboundTransport = new DummyHttpOutboundTransport()
      messageSender = new DidCommMessageSender(
        enveloperService,
        transportService,
        new DidCommModuleConfig({ queueTransportRepository: new InMemoryQueueTransportRepository() }),
        didCommDocumentService,
        eventEmitter
      )
      connection = getMockConnection()

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('return outbound message context with connection, payload and endpoint', async () => {
      const message = new TestMessage()
      const endpoint = 'https://example.com'

      const keys = {
        recipientKeys: [recipientKey],
        routingKeys: [],
        senderKey: senderKey,
      }
      const result = await messageSender.packMessage(agentContext, { message, keys, endpoint })

      expect(result).toEqual({
        payload: encryptedMessage,
        responseRequested: message.hasAnyReturnRoute(),
        endpoint,
      })
    })
  })
})

function getMockDidDocument({ service }: { service: DidDocumentService[] }) {
  return new DidDocument({
    id: 'did:sov:SKJVx2kn373FNgvff1SbJo',
    alsoKnownAs: ['did:sov:SKJVx2kn373FNgvff1SbJo'],
    controller: ['did:sov:SKJVx2kn373FNgvff1SbJo'],
    verificationMethod: [],
    service,
    authentication: [
      new VerificationMethod({
        id: 'did:sov:SKJVx2kn373FNgvff1SbJo#authentication-1',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
        publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      }),
    ],
  })
}

function getMockResolvedDidService(service: DidCommV1Service | IndyAgentService): ResolvedDidCommService {
  return {
    id: service.id,
    serviceEndpoint: service.serviceEndpoint,
    recipientKeys: [verkeyToPublicJwk('EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d')],
    routingKeys: [],
  }
}
