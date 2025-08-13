import { Subject } from 'rxjs'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { DidCommTransportService } from '../DidCommTransportService'
import { DidCommDidExchangeRole } from '../modules'

import { DummyTransportSession } from './stubs'

describe('DidCommTransportService', () => {
  describe('removeSession', () => {
    let transportService: DidCommTransportService

    beforeEach(() => {
      transportService = new DidCommTransportService(
        getAgentContext(),
        new EventEmitter(agentDependencies, new Subject())
      )
    })

    test('remove session saved for a given connection', () => {
      const connection = getMockConnection({ id: 'test-123', role: DidCommDidExchangeRole.Responder })
      const session = new DummyTransportSession('dummy-session-123')
      session.connectionId = connection.id

      transportService.saveSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(session)

      transportService.removeSession(session)
      expect(transportService.findSessionByConnectionId(connection.id)).toEqual(undefined)
    })
  })
})
