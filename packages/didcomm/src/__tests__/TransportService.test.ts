import { Subject } from 'rxjs'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { DidCommTransportService } from '../DidCommTransportService'
import { DidCommDidExchangeRole } from '../modules'
import { DidCommTransportEventTypes } from '../transport'

import { DummyTransportSession } from './stubs'

describe('DidCommTransportService', () => {
  let transportService: DidCommTransportService
  let eventEmitter: EventEmitter

  beforeEach(() => {
    eventEmitter = new EventEmitter(agentDependencies, new Subject())
    transportService = new DidCommTransportService(getAgentContext(), eventEmitter)
  })

  function saveSession(id: string, connectionId: string, { isSingleResponse = true, type = 'http' } = {}) {
    const session = new DummyTransportSession(id)
    session.connectionId = connectionId
    session.isSingleResponse = isSingleResponse
    session.type = type
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

    test('replaces a long-lived session of the same connection and type', () => {
      saveSession('socket-a', 'connection-1', { isSingleResponse: false, type: 'WebSocket' })
      const otherType = saveSession('socket-b', 'connection-1', { isSingleResponse: false, type: 'other' })
      const otherConnection = saveSession('socket-c', 'connection-2', { isSingleResponse: false, type: 'WebSocket' })
      const request = saveSession('request-a', 'connection-1')

      const replacement = saveSession('socket-d', 'connection-1', { isSingleResponse: false, type: 'WebSocket' })

      expect(transportService.findSessionById('socket-a')).toBeUndefined()
      expect(transportService.findSessionById('socket-b')).toBe(otherType)
      expect(transportService.findSessionById('socket-c')).toBe(otherConnection)
      expect(transportService.findSessionById('request-a')).toBe(request)
      expect(transportService.findSessionByConnectionId('connection-1')).toBe(replacement)
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

    test('returns a session that was saved again over one that was first saved later', () => {
      const first = saveSession('request-a', 'connection-1')
      saveSession('request-b', 'connection-1')
      transportService.saveSession(first)

      expect(transportService.findSessionByConnectionId('connection-1')).toBe(first)
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

    test('returns a long-lived session over a more recent single response session', () => {
      const longLived = saveSession('socket', 'connection-1', { isSingleResponse: false })
      saveSession('request-a', 'connection-1')

      expect(transportService.findSessionByConnectionId('connection-1')).toBe(longLived)
    })

    test('returns a single response session only when there is no long-lived one and it is not skipped', () => {
      const singleResponse = saveSession('request-a', 'connection-1')

      expect(transportService.findSessionByConnectionId('connection-1')).toBe(singleResponse)
      expect(
        transportService.findSessionByConnectionId('connection-1', { includeSingleResponse: false })
      ).toBeUndefined()
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

    test('emits one removed event for a session that is removed twice', () => {
      const session = saveSession('request-a', 'connection-1')
      const listener = vi.fn()
      eventEmitter.on(DidCommTransportEventTypes.DidCommTransportSessionRemoved, listener)

      transportService.removeSession(session)
      transportService.removeSession(session)

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })
})
