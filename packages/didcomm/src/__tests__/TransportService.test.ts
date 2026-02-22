import { Subject } from 'rxjs'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { DidCommTransportService } from '../DidCommTransportService'
import { DidCommDidExchangeRole } from '../modules'

import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { InMemoryDidCommTransportSessionRepository } from '../transport'
import { DummyTransportSession } from './stubs'

describe('DidCommTransportService', () => {
  describe('removeSession', () => {
    let transportService: DidCommTransportService

    beforeEach(() => {
      transportService = new DidCommTransportService(
        getAgentContext(),
        new EventEmitter(agentDependencies, new Subject()),
        new DidCommModuleConfig({
          transportSessionRepository: new InMemoryDidCommTransportSessionRepository(),
        })
      )
    })

    test('remove session saved for a given connection', async () => {
      const connection = getMockConnection({ id: 'test-123', role: DidCommDidExchangeRole.Responder })
      transportService = new DidCommTransportService(
        getAgentContext(),
        new EventEmitter(agentDependencies, new Subject()),
        new DidCommModuleConfig({
          transportSessionRepository: new InMemoryDidCommTransportSessionRepository(),
        })
      )
    })

    test('remove session saved for a given connection', async () => {
      const connection = getMockConnection({ id: 'test-123', role: DidCommDidExchangeRole.Responder })
      const session = new DummyTransportSession('dummy-session-123')
      session.connectionId = connection.id

      await transportService.saveSession(session)
      expect(await transportService.findSessionByConnectionId(connection.id)).toEqual(session)

      await transportService.removeSession(session)
      expect(await transportService.findSessionByConnectionId(connection.id)).toEqual(undefined)
    })
  })
})
