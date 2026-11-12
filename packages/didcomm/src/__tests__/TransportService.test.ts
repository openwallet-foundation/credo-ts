import { Subject } from 'rxjs'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { DidCommTransportService } from '../DidCommTransportService'
import { DidCommDidExchangeRole } from '../modules'

import { DummyTransportSession } from './stubs'

describe('DidCommTransportService', () => {
  let transportService: DidCommTransportService

  beforeEach(() => {
    transportService = new DidCommTransportService(
      getAgentContext(),
      new EventEmitter(agentDependencies, new Subject())
    )
  })

  function saveSession(id: string, connectionId: string) {
    const session = new DummyTransportSession(id)
    session.connectionId = connectionId
    transportService.saveSession(session)
    return session
  }

  describe('saveSession', () => {
    test('keeps the sessions of concurrent requests on the same connection', () => {
      const first = saveSession('request-a', 'connection-1')
      const second = saveSession('request-b', 'connection-1')

      expect(transportService.findSessionById('request-a')).toBe(first)
      expect(transportService.findSessionById('request-b')).toBe(second)
    })

    test('removes closed sessions of the same connection', () => {
      const closed = saveSession('request-a', 'connection-1')
      const otherConnection = saveSession('request-b', 'connection-2')
      closed.isClosed = true
      otherConnection.isClosed = true

      saveSession('request-c', 'connection-1')

      expect(transportService.findSessionById('request-a')).toBeUndefined()
      expect(transportService.findSessionById('request-b')).toBe(otherConnection)
    })
  })

  describe('findSessionByConnectionId', () => {
    test('returns the most recently saved session of the connection', () => {
      saveSession('request-a', 'connection-1')
      const second = saveSession('request-b', 'connection-1')
      saveSession('request-c', 'connection-2')

      expect(transportService.findSessionByConnectionId('connection-1')).toBe(second)
    })

    test('skips and removes sessions that are closed', () => {
      const first = saveSession('request-a', 'connection-1')
      const second = saveSession('request-b', 'connection-1')
      const otherConnection = saveSession('request-c', 'connection-2')
      otherConnection.isClosed = true

      second.isClosed = true
      expect(transportService.findSessionByConnectionId('connection-1')).toBe(first)
      expect(transportService.findSessionById('request-b')).toBeUndefined()
      expect(transportService.findSessionById('request-c')).toBeUndefined()

      first.isClosed = true
      expect(transportService.findSessionByConnectionId('connection-1')).toBeUndefined()
    })

    test('skips single response sessions when asked to', () => {
      const longLived = saveSession('socket', 'connection-1')
      const singleResponse = saveSession('request-a', 'connection-1')
      singleResponse.isSingleResponse = true

      expect(transportService.findSessionByConnectionId('connection-1')).toBe(singleResponse)
      expect(transportService.findSessionByConnectionId('connection-1', { includeSingleResponse: false })).toBe(
        longLived
      )
    })
  })

  describe('removeSession', () => {
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
