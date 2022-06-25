import type { ConnectionRecord } from '../../modules/connections'
import type { DidDocumentService } from '../../modules/dids'
import type { MessageRepository } from '../../storage/MessageRepository'
import type { OutboundTransport } from '../../transport'
import type { OutboundMessage, EncryptedMessage } from '../../types'
import type { ResolvedDidCommService } from '../MessageSender'

import { TestMessage } from '../../../tests/TestMessage'
import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../tests/helpers'
import testLogger from '../../../tests/logger'
import { KeyType } from '../../crypto'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { Key, DidDocument, VerificationMethod } from '../../modules/dids'
import { DidCommV1Service } from '../../modules/dids/domain/service/DidCommV1Service'
import { DidResolverService } from '../../modules/dids/services/DidResolverService'
import { InMemoryMessageRepository } from '../../storage/InMemoryMessageRepository'
import { EnvelopeService as EnvelopeServiceImpl } from '../EnvelopeService'
import { MessageSender } from '../MessageSender'
import { TransportService } from '../TransportService'
import { createOutboundMessage } from '../helpers'

import { DummyTransportSession } from './stubs'

jest.mock('../TransportService')
jest.mock('../EnvelopeService')
jest.mock('../../modules/dids/services/DidResolverService')

const logger = testLogger

const TransportServiceMock = TransportService as jest.MockedClass<typeof TransportService>
const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

class DummyHttpOutboundTransport implements OutboundTransport {
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

class DummyWsOutboundTransport implements OutboundTransport {
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

describe('MessageSender', () => {
  const EnvelopeService = <jest.Mock<EnvelopeServiceImpl>>(<unknown>EnvelopeServiceImpl)

  const encryptedMessage: EncryptedMessage = {
    protected: 'base64url',
    iv: 'base64url',
    ciphertext: 'base64url',
    tag: 'base64url',
  }

  const enveloperService = new EnvelopeService()
  const envelopeServicePackMessageMock = mockFunction(enveloperService.packMessage)

  const didResolverService = new DidResolverServiceMock()
  const didResolverServiceResolveMock = mockFunction(didResolverService.resolveDidDocument)

  const inboundMessage = new TestMessage()
  inboundMessage.setReturnRouting(ReturnRouteTypes.all)

  const recipientKey = Key.fromPublicKeyBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K', KeyType.Ed25519)
  const senderKey = Key.fromPublicKeyBase58('79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ', KeyType.Ed25519)
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

  const transportService = new TransportService()
  const transportServiceFindSessionMock = mockFunction(transportService.findSessionByConnectionId)
  const transportServiceFindSessionByIdMock = mockFunction(transportService.findSessionById)
  const transportServiceHasInboundEndpoint = mockFunction(transportService.hasInboundEndpoint)

  const firstDidCommService = new DidCommV1Service({
    id: `<did>;indy`,
    serviceEndpoint: 'https://www.first-endpoint.com',
    recipientKeys: ['#authentication-1'],
  })
  const secondDidCommService = new DidCommV1Service({
    id: `<did>;indy`,
    serviceEndpoint: 'https://www.second-endpoint.com',
    recipientKeys: ['#authentication-1'],
  })

  let messageSender: MessageSender
  let outboundTransport: OutboundTransport
  let messageRepository: MessageRepository
  let connection: ConnectionRecord
  let outboundMessage: OutboundMessage
  const agentConfig = getAgentConfig('MessageSender')
  const agentContext = getAgentContext()

  describe('sendMessage', () => {
    beforeEach(() => {
      TransportServiceMock.mockClear()
      DidResolverServiceMock.mockClear()

      outboundTransport = new DummyHttpOutboundTransport()
      messageRepository = new InMemoryMessageRepository(agentConfig.logger)
      messageSender = new MessageSender(
        enveloperService,
        transportService,
        messageRepository,
        logger,
        didResolverService
      )
      connection = getMockConnection({
        id: 'test-123',
        did: 'did:peer:1mydid',
        theirDid: 'did:peer:1theirdid',
        theirLabel: 'Test 123',
      })
      outboundMessage = createOutboundMessage(connection, new TestMessage())

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
      transportServiceHasInboundEndpoint.mockReturnValue(true)

      const didDocumentInstance = getMockDidDocument({
        service: [firstDidCommService, secondDidCommService],
      })
      didResolverServiceResolveMock.mockResolvedValue(didDocumentInstance)
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('throw error when there is no outbound transport', async () => {
      await expect(messageSender.sendMessage(agentContext, outboundMessage)).rejects.toThrow(
        /Message is undeliverable to connection/
      )
    })

    test('throw error when there is no service or queue', async () => {
      messageSender.registerOutboundTransport(outboundTransport)

      didResolverServiceResolveMock.mockResolvedValue(getMockDidDocument({ service: [] }))

      await expect(messageSender.sendMessage(agentContext, outboundMessage)).rejects.toThrow(
        `Message is undeliverable to connection test-123 (Test 123)`
      )
    })

    test('call send message when session send method fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(session)
      session.send = jest.fn().mockRejectedValue(new Error('some error'))

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(agentContext, outboundMessage)

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connectionId: 'test-123',
        payload: encryptedMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test("resolves the did document using the did resolver if connection.theirDid starts with 'did:'", async () => {
      messageSender.registerOutboundTransport(outboundTransport)

      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(agentContext, outboundMessage)

      expect(didResolverServiceResolveMock).toHaveBeenCalledWith(agentContext, connection.theirDid)
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

      didResolverServiceResolveMock.mockRejectedValue(
        new Error(`Unable to resolve did document for did '${connection.theirDid}': notFound`)
      )

      await expect(messageSender.sendMessage(agentContext, outboundMessage)).rejects.toThrowError(
        `Unable to resolve did document for did '${connection.theirDid}': notFound`
      )
    })

    test('call send message when session send method fails with missing keys', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(sessionWithoutKeys)

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessage(agentContext, outboundMessage)

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
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'sendMessageToService')

      await messageSender.sendMessage(agentContext, { ...outboundMessage, sessionId: 'session-123' })

      expect(session.send).toHaveBeenCalledTimes(1)
      expect(session.send).toHaveBeenNthCalledWith(1, encryptedMessage)
      expect(sendMessageSpy).toHaveBeenCalledTimes(0)
      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(0)
      expect(transportServiceFindSessionByIdMock).toHaveBeenCalledWith('session-123')
    })

    test('call send message on session when there is a session for a given connection', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'sendMessageToService')

      await messageSender.sendMessage(agentContext, outboundMessage)

      const [[, sendMessage]] = sendMessageToServiceSpy.mock.calls

      expect(sendMessage).toMatchObject({
        connectionId: 'test-123',
        message: outboundMessage.payload,
        returnRoute: false,
        service: {
          serviceEndpoint: firstDidCommService.serviceEndpoint,
        },
      })

      expect(sendMessage.senderKey.publicKeyBase58).toEqual('EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d')
      expect(sendMessage.service.recipientKeys.map((key) => key.publicKeyBase58)).toEqual([
        'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      ])

      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(1)
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('calls sendMessageToService with payload and endpoint from second DidComm service when the first fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'sendMessageToService')

      // Simulate the case when the first call fails
      sendMessageSpy.mockRejectedValueOnce(new Error())

      await messageSender.sendMessage(agentContext, outboundMessage)

      const [, [, sendMessage]] = sendMessageToServiceSpy.mock.calls
      expect(sendMessage).toMatchObject({
        connectionId: 'test-123',
        message: outboundMessage.payload,
        returnRoute: false,
        service: {
          serviceEndpoint: secondDidCommService.serviceEndpoint,
        },
      })

      expect(sendMessage.senderKey.publicKeyBase58).toEqual('EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d')
      expect(sendMessage.service.recipientKeys.map((key) => key.publicKeyBase58)).toEqual([
        'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      ])

      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(2)
      expect(sendMessageSpy).toHaveBeenCalledTimes(2)
    })

    test('throw error when message endpoint is not supported by outbound transport schemes', async () => {
      messageSender.registerOutboundTransport(new DummyWsOutboundTransport())
      await expect(messageSender.sendMessage(agentContext, outboundMessage)).rejects.toThrow(
        /Message is undeliverable to connection/
      )
    })
  })

  describe('sendMessageToService', () => {
    const service: ResolvedDidCommService = {
      id: 'out-of-band',
      recipientKeys: [Key.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')],
      routingKeys: [],
      serviceEndpoint: 'https://example.com',
    }
    const senderKey = Key.fromFingerprint('z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')

    beforeEach(() => {
      outboundTransport = new DummyHttpOutboundTransport()
      messageSender = new MessageSender(
        enveloperService,
        transportService,
        new InMemoryMessageRepository(agentConfig.logger),
        logger,
        didResolverService
      )

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('throws error when there is no outbound transport', async () => {
      await expect(
        messageSender.sendMessageToService(agentContext, {
          message: new TestMessage(),
          senderKey,
          service,
        })
      ).rejects.toThrow(`Agent has no outbound transport!`)
    })

    test('calls send message with payload and endpoint from DIDComm service', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendMessageToService(agentContext, {
        message: new TestMessage(),
        senderKey,
        service,
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

      await messageSender.sendMessageToService(agentContext, {
        message,
        senderKey,
        service,
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
      await expect(
        messageSender.sendMessageToService(agentContext, {
          message: new TestMessage(),
          senderKey,
          service,
        })
      ).rejects.toThrow(/Unable to send message to service/)
    })
  })

  describe('packMessage', () => {
    beforeEach(() => {
      outboundTransport = new DummyHttpOutboundTransport()
      messageRepository = new InMemoryMessageRepository(agentConfig.logger)
      messageSender = new MessageSender(
        enveloperService,
        transportService,
        messageRepository,
        logger,
        didResolverService
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
