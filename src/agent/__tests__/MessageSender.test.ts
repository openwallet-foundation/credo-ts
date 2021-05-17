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

  const transportService = new TransportService()
  const transport = new DummyTransport()
  const transportServiceFindTransportMock = mockFunction(transportService.findTransport)
  transportServiceFindTransportMock.mockReturnValue(transport)

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
        transport,
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

/**
 * Returns mock of function with correct type annotations according to original function `fn`.
 * It can be used also for class methods.
 *
 * @param fn function you want to mock
 * @returns mock function with type annotations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}
