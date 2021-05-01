import { ConnectionInvitationMessage, ConnectionRole, DidDoc, IndyAgentService } from '../../modules/connections'
import { getMockConnection } from '../../modules/connections/__tests__/ConnectionService.test'
import { TransportService, HttpTransport, WebSocketTransport, DidCommQueueTransport } from '../TransportService'

describe('TransportService', () => {
  describe('resolveTransport', () => {
    let transportService: TransportService
    let theirDidDoc: DidDoc

    beforeEach(() => {
      theirDidDoc = new DidDoc({
        id: 'test-456',
        publicKey: [],
        authentication: [],
        service: [
          new IndyAgentService({
            id: `<did>;indy`,
            serviceEndpoint: 'https://example.com',
            recipientKeys: ['verkey'],
          }),
        ],
      })

      transportService = new TransportService()
    })

    test('throws error when no transport is resolved for a given connection ID', () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Inviter })
      connection.theirDidDoc = undefined
      expect(() => transportService.resolveTransport(connection)).toThrow(
        `No transport found for connection with id test-123`
      )
    })

    test('returns previously stored transport a given connection ID', () => {
      const connection = getMockConnection({ id: 'test-123' })
      const transport = new HttpTransport('https://endpoint.com')
      transportService.saveTransport('test-123', transport)
      expect(transportService.resolveTransport(connection)).toEqual(transport)
    })

    test('returns HttpTransport transport when their DidDoc contains http endpoint', () => {
      theirDidDoc.service[0].serviceEndpoint = 'https://theirDidDocEndpoint.com'
      const connection = getMockConnection({ id: 'test-123', theirDidDoc })
      expect(transportService.resolveTransport(connection)).toBeInstanceOf(HttpTransport)
      expect(transportService.resolveTransport(connection).endpoint).toEqual('https://theirDidDocEndpoint.com')
    })

    test(`returns WebSocket transport when their DidDoc contains ws endpoint`, () => {
      theirDidDoc.service[0].serviceEndpoint = 'ws://theirDidDocEndpoint.com'
      const connection = getMockConnection({ id: 'test-123', theirDidDoc })
      expect(transportService.resolveTransport(connection)).toBeInstanceOf(WebSocketTransport)
      expect(transportService.resolveTransport(connection).endpoint).toEqual('ws://theirDidDocEndpoint.com')
    })

    test(`returns Queue transport when their DidDoc contains didcomm:transport/queue`, () => {
      theirDidDoc.service[0].serviceEndpoint = 'didcomm:transport/queue'
      const connection = getMockConnection({ id: 'test-123', theirDidDoc })
      expect(transportService.resolveTransport(connection)).toBeInstanceOf(DidCommQueueTransport)
      expect(transportService.resolveTransport(connection).endpoint).toEqual('didcomm:transport/queue')
    })

    test(`returns transport with service endpoint from invitation if there is no their DidDoc and role is ${ConnectionRole.Invitee}`, () => {
      const invitation = new ConnectionInvitationMessage({
        label: 'test',
        recipientKeys: ['verkey'],
        serviceEndpoint: 'https://invitationEndpoint.com',
      })
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Invitee, invitation })
      connection.theirDidDoc = undefined
      expect(transportService.resolveTransport(connection)).toBeInstanceOf(HttpTransport)
      expect(transportService.resolveTransport(connection).endpoint).toEqual('https://invitationEndpoint.com')
    })
  })
})
