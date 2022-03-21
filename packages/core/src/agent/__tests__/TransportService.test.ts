import { getMockConnection, getMockOutOfBand } from '../../../tests/helpers'
import { ConnectionRole, DidDoc } from '../../modules/connections'
import { DidCommService } from '../../modules/dids/domain/service/DidCommService'
import { TransportService } from '../TransportService'

import { DummyTransportSession } from './stubs'

describe('TransportService', () => {
  describe('findServices', () => {
    let transportService: TransportService
    let theirDidDoc: DidDoc
    const testDidCommService = new DidCommService({
      id: `<did>;indy`,
      serviceEndpoint: 'https://example.com',
      recipientKeys: ['verkey'],
    })

    beforeEach(() => {
      theirDidDoc = new DidDoc({
        id: 'test-456',
        publicKey: [],
        authentication: [],
        service: [testDidCommService],
      })

      transportService = new TransportService()
    })

    test(`returns empty array when there is no their DidDoc and role is ${ConnectionRole.Inviter}`, () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Inviter })
      const outOfBand = getMockOutOfBand()
      connection.theirDidDoc = undefined
      expect(transportService.findDidCommServices(connection, outOfBand)).toEqual([])
    })

    test(`returns empty array when there is no their DidDoc, no OutOfBand and role is ${ConnectionRole.Invitee}`, () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Invitee })
      connection.theirDidDoc = undefined
      expect(transportService.findDidCommServices(connection)).toEqual([])
    })

    test(`returns service from their DidDoc`, () => {
      const connection = getMockConnection({ id: 'test-123', theirDidDoc })
      expect(transportService.findDidCommServices(connection)).toEqual([testDidCommService])
    })

    test(`returns service from invitation when there is no their DidDoc and role is ${ConnectionRole.Invitee}`, () => {
      const outOfBand = getMockOutOfBand({
        label: 'test',
        recipientKeys: ['verkey'],
        serviceEndpoint: 'ws://invitationEndpoint.com',
      })
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Invitee })
      connection.theirDidDoc = undefined
      expect(transportService.findDidCommServices(connection, outOfBand)).toEqual([
        new DidCommService({
          id: '#inline-0',
          serviceEndpoint: 'ws://invitationEndpoint.com',
          routingKeys: [],
          recipientKeys: ['verkey'],
        }),
      ])
    })
  })

  describe('removeSession', () => {
    let transportService: TransportService

    beforeEach(() => {
      transportService = new TransportService()
    })

    test(`remove session saved for a given connection`, () => {
      const connection = getMockConnection({ id: 'test-123', role: ConnectionRole.Inviter })
      const session = new DummyTransportSession('dummy-session-123')
      session.connection = connection

      transportService.saveSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(session)

      transportService.removeSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(undefined)
    })
  })
})
