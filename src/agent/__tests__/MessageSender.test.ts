import testLogger from '../../__tests__/logger'
import { MessageSender } from '../MessageSender'
import { Transport, TransportService as TransportServiceImpl } from '../TransportService'
import { EnvelopeService as EnvelopeServiceImpl } from '../EnvelopeService'
import { createOutboundMessage } from '../helpers'
import { AgentMessage } from '../AgentMessage'
import { OutboundTransporter } from '../../transport'
import { OutboundPackage } from '../..'
import { OutboundMessage } from '../../types'
import { ConnectionRecord } from '../../modules/connections'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { getMockConnection } from '../../__tests__/helpers'

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
  public sendMessage(outboundPackage: OutboundPackage): Promise<any> {
    return Promise.resolve()
  }
}

class DummyTransport implements Transport {
  public readonly type = 'websocket'
  public endpoint = 'endpoint'
}

describe('MessageSender', () => {
  describe('sendMessage', () => {
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
    const envelopeServicePackMessageMock = enveloperService.packMessage as jest.Mock<
      Promise<JsonWebKey>,
      [OutboundMessage]
    >
    envelopeServicePackMessageMock.mockReturnValue(Promise.resolve(wireMessage))

    const transport = new DummyTransport()
    const transportService = new TransportService()
    const transportServiceResolveTransportMock = transportService.resolveTransport as jest.Mock<
      Transport,
      [ConnectionRecord]
    >
    transportServiceResolveTransportMock.mockReturnValue(transport)

    let messageSender: MessageSender
    let outboundTransporter: OutboundTransporter
    let connection: ConnectionRecord

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
        endpoint: outboundMessage.endpoint,
        responseRequested: false,
        transport,
      })
    })

    test('when message has return route calls transporter with responseRequested', async () => {
      const message = new AgentMessage()
      const spy = jest.spyOn(outboundTransporter, 'sendMessage')
      message.setReturnRouting(ReturnRouteTypes.all)
      const outboundMessage = createOutboundMessage(connection, message)
      messageSender.setOutboundTransporter(outboundTransporter)

      await messageSender.sendMessage(outboundMessage)

      const [[sendMessageCall]] = spy.mock.calls
      expect(sendMessageCall.responseRequested).toEqual(true)
    })
  })
})
