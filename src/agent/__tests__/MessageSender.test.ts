import type { ConnectionRecord } from '../../modules/connections'
import type { OutboundTransporter } from '../../transport'
import type { TransportSession } from '../TransportService'

import { getMockConnection, mockFunction } from '../../__tests__/helpers'
import testLogger from '../../__tests__/logger'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { AgentMessage } from '../AgentMessage'
import { EnvelopeService as EnvelopeServiceImpl } from '../EnvelopeService'
import { MessageSender } from '../MessageSender'
import { TransportService as TransportServiceImpl } from '../TransportService'
import { createOutboundMessage } from '../helpers'

jest.mock('../TransportService')
jest.mock('../EnvelopeService')

const logger = testLogger

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
  public readonly type = 'dummy'
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
  envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(wireMessage))

  const transportService = new TransportService()
  const session = new DummyTransportSession()
  const transportServiceFindSessionMock = mockFunction(transportService.findSession)
  transportServiceFindSessionMock.mockReturnValue(session)

  const endpoint = 'https://www.exampleEndpoint.com'
  const transportServiceFindEndpointMock = mockFunction(transportService.findEndpoint)
  transportServiceFindEndpointMock.mockReturnValue(endpoint)

  let messageSender: MessageSender
  let outboundTransporter: OutboundTransporter
  let connection: ConnectionRecord

  describe('sendMessage', () => {
    beforeEach(() => {
      outboundTransporter = new DummyOutboundTransporter()
      messageSender = new MessageSender(enveloperService, transportService, logger)
      connection = getMockConnection({ id: 'test-123' })
    })

    test('throws error when there is no outbound transport', async () => {
      const message = new AgentMessage()
      const outboundMessage = createOutboundMessage(connection, message)
      await expect(messageSender.sendMessage(outboundMessage)).rejects.toThrow(`Agent has no outbound transporter!`)
    })

    test('calls transporter with connection, payload and endpoint', async () => {
      const message = new AgentMessage()
      const spy = jest.spyOn(outboundTransporter, 'sendMessage')
      const outboundMessage = createOutboundMessage(connection, message)
      messageSender.setOutboundTransporter(outboundTransporter)

      await messageSender.sendMessage(outboundMessage)

      const [[sendMessageCall]] = spy.mock.calls
      expect(sendMessageCall).toEqual({
        connection,
        payload: wireMessage,
        endpoint,
        responseRequested: false,
        session,
      })
    })
  })

  describe('packMessage', () => {
    beforeEach(() => {
      outboundTransporter = new DummyOutboundTransporter()
      messageSender = new MessageSender(enveloperService, transportService, logger)
      connection = getMockConnection({ id: 'test-123' })
    })

    test('returns outbound message context with connection, payload and endpoint', async () => {
      const message = new AgentMessage()
      const outboundMessage = createOutboundMessage(connection, message)

      const result = await messageSender.packMessage(outboundMessage)

      expect(result).toEqual({
        connection,
        payload: wireMessage,
        endpoint,
        responseRequested: false,
      })
    })

    test('when message has return route returns outbound message context with responseRequested', async () => {
      const message = new AgentMessage()
      message.setReturnRouting(ReturnRouteTypes.all)
      const outboundMessage = createOutboundMessage(connection, message)

      const result = await messageSender.packMessage(outboundMessage)

      expect(result.responseRequested).toEqual(true)
    })
  })
})
