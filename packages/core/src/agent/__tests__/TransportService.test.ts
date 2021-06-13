import { getMockConnection } from '../../../tests/helpers'
import testLogger from '../../../tests/logger'
import { ConnectionInvitationMessage, ConnectionRole, DidDoc, IndyAgentService } from '../../modules/connections'
import { TransportService } from '../TransportService'

const logger = testLogger

describe('TransportService', () => {
  describe('findEndpoint', () => {
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

      transportService = new TransportService(logger)
    })

    test(`throws error when there is no their DidDoc and role is ${ConnectionRole.Inviter}`, () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Inviter })
      connection.theirDidDoc = undefined
      expect(() => transportService.findEndpoint(connection)).toThrow(
        `No endpoint found for connection with id test-123`
      )
    })

    test(`throws error when there is no their DidDoc, no invitation and role is ${ConnectionRole.Invitee}`, () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Invitee })
      connection.theirDidDoc = undefined
      connection.invitation = undefined
      expect(() => transportService.findEndpoint(connection)).toThrow(
        `No endpoint found for connection with id test-123`
      )
    })

    test(`returns endpoint from their DidDoc`, () => {
      theirDidDoc.service[0].serviceEndpoint = 'ws://theirDidDocEndpoint.com'
      const connection = getMockConnection({ id: 'test-123', theirDidDoc })
      expect(transportService.findEndpoint(connection)).toEqual('ws://theirDidDocEndpoint.com')
    })

    test(`returns endpoint from invitation when there is no their DidDoc and role is ${ConnectionRole.Invitee}`, () => {
      const invitation = new ConnectionInvitationMessage({
        label: 'test',
        recipientKeys: ['verkey'],
        serviceEndpoint: 'ws://invitationEndpoint.com',
      })
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Invitee, invitation })
      connection.theirDidDoc = undefined
      expect(transportService.findEndpoint(connection)).toEqual('ws://invitationEndpoint.com')
    })
  })
})
