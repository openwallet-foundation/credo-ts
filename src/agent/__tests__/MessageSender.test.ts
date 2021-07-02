import type { ConnectionRecord } from '../../modules/connections'
import type { OutboundTransporter } from '../../transport'
import type { OutboundMessage, OutboundPackage } from '../../types'
import type { EnvelopeKeys } from '../EnvelopeService'
import type { TransportSession } from '../TransportService'

import { getMockConnection, mockFunction } from '../../__tests__/helpers'
import testLogger from '../../__tests__/logger'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { ConsoleLogger, LogLevel } from '../../logger'
import { DidCommService } from '../../modules/connections'
import { AgentMessage } from '../AgentMessage'
import { EnvelopeService as EnvelopeServiceImpl } from '../EnvelopeService'
import { MessageSender } from '../MessageSender'
import { TransportService as TransportServiceImpl } from '../TransportService'
import { createOutboundMessage } from '../helpers'

jest.mock('../TransportService')
jest.mock('../EnvelopeService')

const logger = new ConsoleLogger(LogLevel.debug)

class DummyOutboundTransporter implements OutboundTransporter {
  public start(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public stop(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public supportedSchemes: string[] = []

  public sendMessage() {
    return Promise.resolve()
  }
}

class DummyTransportSession implements TransportSession {
  public readonly type = 'http'
  public keys: EnvelopeKeys | undefined
  public send(outboundMessage: OutboundPackage): Promise<void> {
    throw new Error('Method not implemented.')
  }
}

describe('MessageSender', () => {
  const TransportService = <jest.Mock<TransportServiceImpl>>(<unknown>TransportServiceImpl)
  const EnvelopeService = <jest.Mock<EnvelopeServiceImpl>>(<unknown>EnvelopeServiceImpl)

  const wireMessage = {
    alg: 'EC',
    crv: 'P-256',
    x: 'MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4',
    y: '4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM',
    use: 'enc',
    kid: '1',
  }

  const enveloperService = new EnvelopeService()
  const envelopeServicePackMessageMock = mockFunction(enveloperService.packMessage)

  const session = new DummyTransportSession()
  session.keys = {
    recipientKeys: ['verkey'],
    routingKeys: [],
    senderKey: 'senderKey',
  }
  session.send = jest.fn()

  const sessionWithoutKeys = new DummyTransportSession()
  sessionWithoutKeys.send = jest.fn()

  const transportService = new TransportService()
  const transportServiceFindSessionMock = mockFunction(transportService.findSession)

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
  let outboundTransporter: OutboundTransporter
  let connection: ConnectionRecord
  let outboundMessage: OutboundMessage

  describe('sendMessage', () => {
    beforeEach(() => {
      outboundTransporter = new DummyOutboundTransporter()
      messageSender = new MessageSender(enveloperService, transportService, logger)
      connection = getMockConnection({ id: 'test-123' })

      outboundMessage = createOutboundMessage(connection, new AgentMessage())

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(wireMessage))
      transportServiceFindServicesMock.mockReturnValue([firstDidCommService, secondDidCommService])
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('throw error when there is no outbound transport', async () => {
      await expect(messageSender.sendMessage(outboundMessage)).rejects.toThrow(`Agent has no outbound transporter!`)
    })

    test('throw error when there is no service', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      transportServiceFindServicesMock.mockReturnValue([])

      await expect(messageSender.sendMessage(outboundMessage)).rejects.toThrow(
        `Connection with id test-123 has no service!`
      )
    })

    test('throw error when there is a session without keys', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      transportServiceFindSessionMock.mockReturnValue(sessionWithoutKeys)

      await expect(messageSender.sendMessage(outboundMessage)).rejects.toThrow(
        `There are no keys for the given http transport session.`
      )
    })

    test('call send message when session send method fails', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      transportServiceFindSessionMock.mockReturnValue(session)
      session.send = jest.fn().mockRejectedValue(new Error('some error'))

      messageSender.setOutboundTransporter(outboundTransporter)
      const sendMessageSpy = jest.spyOn(outboundTransporter, 'sendMessage')

      await messageSender.sendMessage(outboundMessage)

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connection,
        payload: wireMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('call send message on session when there is a session for a given connection', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      const sendMessageSpy = jest.spyOn(outboundTransporter, 'sendMessage')
      transportServiceFindSessionMock.mockReturnValue(session)

      await messageSender.sendMessage(outboundMessage)

      expect(session.send).toHaveBeenCalledWith({
        connection,
        payload: wireMessage,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(0)
    })

    test('call send message with connection, payload and endpoint from first DidComm service', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      const sendMessageSpy = jest.spyOn(outboundTransporter, 'sendMessage')

      await messageSender.sendMessage(outboundMessage)

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connection,
        payload: wireMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })

    test('call send message with connection, payload and endpoint from second DidComm service when the first fails', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      const sendMessageSpy = jest.spyOn(outboundTransporter, 'sendMessage')

      // Simulate the case when the first call fails
      sendMessageSpy.mockRejectedValueOnce(new Error())

      await messageSender.sendMessage(outboundMessage)

      expect(sendMessageSpy).toHaveBeenNthCalledWith(2, {
        connection,
        payload: wireMessage,
        endpoint: secondDidCommService.serviceEndpoint,
        responseRequested: false,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(2)
    })

    test('call send message with responseRequested when message has return route', async () => {
      messageSender.setOutboundTransporter(outboundTransporter)
      const sendMessageSpy = jest.spyOn(outboundTransporter, 'sendMessage')

      const message = new AgentMessage()
      message.setReturnRouting(ReturnRouteTypes.all)
      const outboundMessage = createOutboundMessage(connection, message)

      await messageSender.sendMessage(outboundMessage)

      expect(sendMessageSpy).toHaveBeenCalledWith({
        connection,
        payload: wireMessage,
        endpoint: firstDidCommService.serviceEndpoint,
        responseRequested: true,
      })
      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('packMessage', () => {
    beforeEach(() => {
      outboundTransporter = new DummyOutboundTransporter()
      messageSender = new MessageSender(enveloperService, transportService, logger)
      connection = getMockConnection({ id: 'test-123' })

      envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(wireMessage))
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    test('return outbound message context with connection, payload and endpoint', async () => {
      const message = new AgentMessage()
      const outboundMessage = createOutboundMessage(connection, message)

      const keys = {
        recipientKeys: ['service.recipientKeys'],
        routingKeys: [],
        senderKey: connection.verkey,
      }
      const result = await messageSender.packMessage(outboundMessage, keys)

      expect(result).toEqual({
        connection,
        payload: wireMessage,
      })
    })
  })
})
