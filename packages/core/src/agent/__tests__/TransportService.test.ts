import { getMockConnection } from '../../../tests/helpers'
import { DidExchangeRole } from '../../modules/connections'
import { TransportService } from '../TransportService'

import { DummyTransportSession } from './stubs'

describe('TransportService', () => {
  describe('removeSession', () => {
    let transportService: TransportService

    beforeEach(() => {
      transportService = new TransportService()
    })

    test(`remove session saved for a given connection`, () => {
      const connection = getMockConnection({ id: 'test-123', role: DidExchangeRole.Responder })
      const session = new DummyTransportSession('dummy-session-123')
      session.connectionId = connection.id

      transportService.saveSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(session)

      transportService.removeSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(undefined)
    })
  })
})
