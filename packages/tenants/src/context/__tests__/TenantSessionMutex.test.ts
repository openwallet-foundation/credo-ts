import testLogger from '../../../../core/tests/logger'
import { TenantSessionMutex } from '../TenantSessionMutex'

describe('TenantSessionMutex', () => {
  test('correctly sets values', () => {
    const tenantSessionMutex = new TenantSessionMutex(testLogger, 12, 50)

    expect(tenantSessionMutex.maxSessions).toBe(12)
    expect(tenantSessionMutex.currentSessions).toBe(0)
  })

  describe('acquireSession', () => {
    test('should immediately acquire the session if maxSessions has not been reached', async () => {
      const tenantSessionMutex = new TenantSessionMutex(testLogger, 1, 0)

      expect(tenantSessionMutex.currentSessions).toBe(0)
      await expect(tenantSessionMutex.acquireSession()).resolves.toBeUndefined()
      expect(tenantSessionMutex.currentSessions).toBe(1)
    })

    test('should throw an error if a session could not be acquired within sessionAcquireTimeout', async () => {
      const tenantSessionMutex = new TenantSessionMutex(testLogger, 1, 0)

      expect(tenantSessionMutex.currentSessions).toBe(0)
      await tenantSessionMutex.acquireSession()
      expect(tenantSessionMutex.currentSessions).toBe(1)
      await expect(tenantSessionMutex.acquireSession()).rejects.toThrow(
        'Failed to acquire an agent context session within 0ms'
      )
      expect(tenantSessionMutex.currentSessions).toBe(1)
    })
  })

  describe('releaseSession', () => {
    test('should release the session', async () => {
      const tenantSessionMutex = new TenantSessionMutex(testLogger, 1, 0)
      expect(tenantSessionMutex.currentSessions).toBe(0)

      await tenantSessionMutex.acquireSession()
      expect(tenantSessionMutex.currentSessions).toBe(1)

      expect(tenantSessionMutex.releaseSession()).toBeUndefined()
      expect(tenantSessionMutex.currentSessions).toBe(0)
    })

    test('resolves an acquire sessions if another sessions is being released', async () => {
      const tenantSessionMutex = new TenantSessionMutex(testLogger, 1, 100)
      expect(tenantSessionMutex.currentSessions).toBe(0)

      await tenantSessionMutex.acquireSession()
      expect(tenantSessionMutex.currentSessions).toBe(1)

      const acquirePromise = tenantSessionMutex.acquireSession()
      tenantSessionMutex.releaseSession()
      expect(tenantSessionMutex.currentSessions).toBe(0)

      await acquirePromise
      expect(tenantSessionMutex.currentSessions).toBe(1)
    })
  })
})
