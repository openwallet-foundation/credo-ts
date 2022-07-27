import type { ConnectionRecord } from '../../modules/connections'
import type { MessageRepository } from '../../storage/MessageRepository'
import type { OutboundTransport } from '../../transport'
import type { OutboundMessage } from '../../types'
import type { EncryptedMessage } from '../didcomm'

import { TestMessage } from '../../../tests/TestMessage'
import { getAgentConfig, getMockConnection, mockFunction } from '../../../tests/helpers'
import testLogger from '../../../tests/logger'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { DidDocument, DidType, IndyAgentService } from '../../modules/dids'
import { DidCommService } from '../../modules/dids/domain/service/DidCommService'
import { DidResolverService } from '../../modules/dids/services/DidResolverService'
import { InMemoryMessageRepository } from '../../storage/InMemoryMessageRepository'
import { MessageSender } from '../MessageSender'
import { TransportService } from '../TransportService'
import { EnvelopeService as EnvelopeServiceImpl } from '../didcomm/EnvelopeService'
import { createOutboundMessage } from '../helpers'

import { DummyTransportSession } from './stubs'

jest.mock('../TransportService')
jest.mock('../didcomm/EnvelopeService')
jest.mock('../../modules/dids/services/DidResolverService')

const TransportServiceMock = TransportService as jest.MockedClass<typeof TransportService>
const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>
const logger = testLogger
class DummyOutboundTransport implements OutboundTransport {
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

describe('MessageSender', () => {
  const EnvelopeService = <jest.Mock<EnvelopeServiceImpl>>(<unknown>EnvelopeServiceImpl)

  const encryptedMessage: EncryptedMessage = {
    protected: 'base64url',
    iv: 'base64url',
    ciphertext: 'base64url',
    tag: 'base64url',
  }

  const enveloperService = new EnvelopeService()
  const envelopeServicePackMessageMock = mockFunction(enveloperService.packMessageEncrypted)

  const inboundMessage = new TestMessage()
  inboundMessage.setReturnRouting(ReturnRouteTypes.all)

  const session = new DummyTransportSession('session-123')
  session.keys = {
    recipientKeys: ['verkey'],
    routingKeys: [],
    senderKey: 'senderKey',
  }
  session.inboundMessage = inboundMessage
  session.send = jest.fn()

  const sessionWithoutKeys = new DummyTransportSession('sessionWithoutKeys-123')
  sessionWithoutKeys.inboundMessage = inboundMessage
  sessionWithoutKeys.send = jest.fn()

  const transportService = new TransportService()
  const transportServiceFindSessionMock = mockFunction(transportService.findSessionByConnectionId)
  const transportServiceHasInboundEndpoint = mockFunction(transportService.hasInboundEndpoint)

  const firstDidCommService = new DidCommService({
    id: `<did>;indy`,
    serviceEndpoint: 'https://www.first-endpoint.com',
    recipientKeys: ['verkey'],
  })
  const secondDidCommService = new DidCommService({
    id: `<did>;indy`,
    serviceEndpoint: 'https://www.second-endpoint.com',
    recipientKeys: ['verkey'],
  })
  const transportServiceFindServicesMock = mockFunction(transportService.findDidCommServices)

  let messageSender: MessageSender
  let outboundTransport: OutboundTransport
  let messageRepository: MessageRepository
  let connection: ConnectionRecord
  let outboundMessage: OutboundMessage
  let didResolverService: DidResolverService

  describe('sendMessage', () => {
    beforeEach(() => {
      TransportServiceMock.mockClear()
      transportServiceHasInboundEndpoint.mockReturnValue(true)

      didResolverService = new DidResolverServiceMock()
      outboundTransport = new DummyOutboundTransport()
      messageRepository = new InMemoryMessageRepository(getAgentConfig('MessageSender'))
      messageSender = new MessageSender(
        getAgentConfig('MessageSenderTest'),
        enveloperService,
        transportService,
        messageRepository,
        logger,
        didResolverService
      )
      connection = getMockConnection({ id: 'test-123', theirLabel: 'Test 123' })

      outboundMessage = createOutboundMessage(connection, new TestMessage())

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
      transportServiceFindServicesMock.mockReturnValue([firstDidCommService, secondDidCommService])
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('throw error when there is no outbound transport', async () => {
      await expect(messageSender.sendDIDCommV1Message(outboundMessage)).rejects.toThrow(
        /Message is undeliverable to connection/
      )
    })

    test('throw error when there is no service or queue', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindServicesMock.mockReturnValue([])

      await expect(messageSender.sendDIDCommV1Message(outboundMessage)).rejects.toThrow(
        `Message is undeliverable to connection test-123 (Test 123)`
      )
    })

    test('call send message when session send method fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(session)
      session.send = jest.fn().mockRejectedValue(new Error('some error'))

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendDIDCommV1Message(outboundMessage)

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

      const did = 'did:peer:1exampledid'
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      const resolveMock = mockFunction(didResolverService.resolve)

      connection.theirDid = did
      resolveMock.mockResolvedValue({
        didDocument: new DidDocument({
          id: did,
          service: [firstDidCommService, secondDidCommService],
        }),
        didResolutionMetadata: {},
        didDocumentMetadata: {},
        didType: DidType.Unknown,
      })

      await messageSender.sendDIDCommV1Message(outboundMessage)

      expect(resolveMock).toHaveBeenCalledWith(did)
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

      const did = 'did:peer:1exampledid'
      const resolveMock = mockFunction(didResolverService.resolve)

      connection.theirDid = did
      resolveMock.mockResolvedValue({
        didDocument: null,
        didResolutionMetadata: {
          error: 'notFound',
        },
        didDocumentMetadata: {},
        didType: DidType.Unknown,
      })

      await expect(messageSender.sendDIDCommV1Message(outboundMessage)).rejects.toThrowError(
        `Unable to resolve did document for did '${did}': notFound`
      )
    })

    test('call send message when session send method fails with missing keys', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      transportServiceFindSessionMock.mockReturnValue(sessionWithoutKeys)

      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.sendDIDCommV1Message(outboundMessage)

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connectionId: 'test-123',
        payload: encryptedMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('call send message on session when there is a session for a given connection', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'packAndSendMessage')

      await messageSender.sendDIDCommV1Message(outboundMessage)

      expect(sendMessageToServiceSpy).toHaveBeenCalledWith({
        connection: connection,
        message: outboundMessage.payload,
        senderKey: connection.verkey,
        service: firstDidCommService,
        returnRoute: false,
      })
      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(1)
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('calls packAndSendMessage with payload and endpoint from second DidComm service when the first fails', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')
      const sendMessageToServiceSpy = jest.spyOn(messageSender, 'packAndSendMessage')

      // Simulate the case when the first call fails
      sendMessageSpy.mockRejectedValueOnce(new Error())

      await messageSender.sendDIDCommV1Message(outboundMessage)

      expect(sendMessageToServiceSpy).toHaveBeenNthCalledWith(2, {
        connection: connection,
        message: outboundMessage.payload,
        senderKey: connection.verkey,
        service: secondDidCommService,
        returnRoute: false,
      })
      expect(sendMessageToServiceSpy).toHaveBeenCalledTimes(2)
      expect(sendMessageSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('sendMessageToService', () => {
    const service = new DidCommService({
      id: 'out-of-band',
      recipientKeys: ['someKey'],
      serviceEndpoint: 'https://example.com',
    })
    const senderKey = 'someVerkey'

    beforeEach(() => {
      outboundTransport = new DummyOutboundTransport()
      messageSender = new MessageSender(
        getAgentConfig('MessageSenderTest'),
        enveloperService,
        transportService,
        new InMemoryMessageRepository(getAgentConfig('MessageSenderTest')),
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
        messageSender.packAndSendMessage({
          message: new TestMessage(),
          senderKey,
          service,
        })
      ).rejects.toThrow(`Agent has no outbound transport!`)
    })

    test('calls send message with payload and endpoint from DIDComm service', async () => {
      messageSender.registerOutboundTransport(outboundTransport)
      const sendMessageSpy = jest.spyOn(outboundTransport, 'sendMessage')

      await messageSender.packAndSendMessage({
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

      await messageSender.packAndSendMessage({
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
  })

  describe('packMessage', () => {
    beforeEach(() => {
      outboundTransport = new DummyOutboundTransport()
      messageRepository = new InMemoryMessageRepository(getAgentConfig('PackMessage'))
      messageSender = new MessageSender(
        getAgentConfig('MessageSenderTest'),
        enveloperService,
        transportService,
        messageRepository,
        logger,
        didResolverService
      )
      connection = getMockConnection({ id: 'test-123' })

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(encryptedMessage))
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('return outbound message context with connection, payload and endpoint', async () => {
      const message = new TestMessage()
      const endpoint = 'https://example.com'

      const result = await messageSender.packMessage({
        message,
        senderKey: connection.verkey,
        service: new IndyAgentService({
          id: 'test',
          recipientKeys: ['service.recipientKeys'],
          routingKeys: [],
          serviceEndpoint: endpoint,
        }),
      })

      expect(result).toEqual({
        payload: encryptedMessage,
        responseRequested: message.hasAnyReturnRoute(),
      })
    })
  })
})
