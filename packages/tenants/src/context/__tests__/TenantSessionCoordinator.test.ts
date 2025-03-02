import type { DependencyManager } from '@credo-ts/core'
import type { TenantAgentContextMapping } from '../TenantSessionCoordinator'

import { AgentConfig, AgentContext, WalletApi } from '@credo-ts/core'
import { Mutex, withTimeout } from 'async-mutex'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { TenantsModuleConfig } from '../../TenantsModuleConfig'
import { TenantRecord } from '../../repository'
import { TenantSessionCoordinator } from '../TenantSessionCoordinator'
import { TenantSessionMutex } from '../TenantSessionMutex'

jest.mock('../TenantSessionMutex')
const TenantSessionMutexMock = TenantSessionMutex as jest.Mock<TenantSessionMutex>

// tenantAgentContextMapping is private, but we need to access it to properly test this class. Adding type override to
// make sure we don't get a lot of type errors.
type PublicTenantAgentContextMapping = Omit<TenantSessionCoordinator, 'tenantAgentContextMapping'> & {
  tenantAgentContextMapping: TenantAgentContextMapping
}

const wallet = {
  initialize: jest.fn(),
} as unknown as WalletApi

const agentContext = getAgentContext({
  agentConfig: getAgentConfig('TenantSessionCoordinator'),
})

agentContext.dependencyManager.registerInstance(WalletApi, wallet)
const tenantSessionCoordinator = new TenantSessionCoordinator(
  agentContext,
  testLogger,
  new TenantsModuleConfig()
) as unknown as PublicTenantAgentContextMapping

const tenantSessionMutexMock = TenantSessionMutexMock.mock.instances[0]

describe('TenantSessionCoordinator', () => {
  afterEach(() => {
    tenantSessionCoordinator.tenantAgentContextMapping = {}
    jest.clearAllMocks()
  })

  describe('getContextForSession', () => {
    test('returns the context from the tenantAgentContextMapping and increases the session count if already available', async () => {
      const tenant1AgentContext = jest.fn() as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: new Mutex(),
        sessionCount: 1,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        tenant1,
      }

      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
        storageVersion: '0.5',
      })

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)
      expect(tenantSessionMutexMock.acquireSession).toHaveBeenCalledTimes(1)
      expect(tenantAgentContext).toBe(tenant1AgentContext)
      expect(tenant1.sessionCount).toBe(2)
    })

    test('creates a new agent context, initializes the wallet and stores it in the tenant agent context mapping', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
        storageVersion: '0.5',
      })
      const createChildSpy = jest.spyOn(agentContext.dependencyManager, 'createChild')
      const extendSpy = jest.spyOn(agentContext.config, 'extend')

      const tenantDependencyManager = {
        registerInstance: jest.fn(),
        resolve: jest.fn(() => wallet),
      } as unknown as DependencyManager

      createChildSpy.mockReturnValue(tenantDependencyManager)

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)

      expect(wallet.initialize).toHaveBeenCalledWith({
        ...tenantRecord.config.walletConfig,
        storage: { config: { inMemory: true }, type: 'sqlite' },
      })
      expect(tenantSessionMutexMock.acquireSession).toHaveBeenCalledTimes(1)
      expect(extendSpy).toHaveBeenCalledWith({
        ...tenantRecord.config,
        walletConfig: { ...tenantRecord.config.walletConfig, storage: { config: { inMemory: true }, type: 'sqlite' } },
      })
      expect(createChildSpy).toHaveBeenCalledWith()
      expect(tenantDependencyManager.registerInstance).toHaveBeenCalledWith(AgentContext, expect.any(AgentContext))
      expect(tenantDependencyManager.registerInstance).toHaveBeenCalledWith(AgentConfig, expect.any(AgentConfig))

      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenantAgentContext,
        mutex: expect.objectContaining({
          acquire: expect.any(Function),
          cancel: expect.any(Function),
          isLocked: expect.any(Function),
          release: expect.any(Function),
          runExclusive: expect.any(Function),
          waitForUnlock: expect.any(Function),
        }),
        sessionCount: 1,
      })

      expect(tenantAgentContext.contextCorrelationId).toBe('tenant1')
    })

    test('rethrows error and releases session if error is throw while getting agent context', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
        storageVersion: '0.5',
      })

      // Throw error during wallet initialization
      mockFunction(wallet.initialize).mockRejectedValue(new Error('Test error'))

      await expect(tenantSessionCoordinator.getContextForSession(tenantRecord)).rejects.toThrowError('Test error')

      expect(wallet.initialize).toHaveBeenCalledWith({
        ...tenantRecord.config.walletConfig,
        storage: { config: { inMemory: true }, type: 'sqlite' },
      })
      expect(tenantSessionMutexMock.acquireSession).toHaveBeenCalledTimes(1)
      expect(tenantSessionMutexMock.releaseSession).toHaveBeenCalledTimes(1)
    })

    test('locks and waits for lock to release when initialization is already in progress', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
        storageVersion: '0.5',
      })

      // Add timeout to mock the initialization and we can test that the mutex is used.
      mockFunction(wallet.initialize).mockReturnValueOnce(new Promise((resolve) => setTimeout(resolve, 100)))

      // Start two context session creations (but don't await). It should set the mutex property on the tenant agent context mapping.
      const tenantAgentContext1Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      const tenantAgentContext2Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toBeUndefined()

      // Await first session promise, should have 1 session
      const tenantAgentContext1 = await tenantAgentContext1Promise
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenantAgentContext1,
        sessionCount: 1,
        mutex: expect.objectContaining({
          acquire: expect.any(Function),
          cancel: expect.any(Function),
          isLocked: expect.any(Function),
          release: expect.any(Function),
          runExclusive: expect.any(Function),
          waitForUnlock: expect.any(Function),
        }),
      })

      // There should be two sessions active now
      const tenantAgentContext2 = await tenantAgentContext2Promise
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenantAgentContext1,
        sessionCount: 2,
        mutex: expect.objectContaining({
          acquire: expect.any(Function),
          cancel: expect.any(Function),
          isLocked: expect.any(Function),
          release: expect.any(Function),
          runExclusive: expect.any(Function),
          waitForUnlock: expect.any(Function),
        }),
      })

      // Initialize should only be called once
      expect(wallet.initialize).toHaveBeenCalledWith({
        ...tenantRecord.config.walletConfig,
        storage: { config: { inMemory: true }, type: 'sqlite' },
      })
      expect(wallet.initialize).toHaveBeenCalledTimes(1)

      expect(tenantAgentContext1).toBe(tenantAgentContext2)
    })
  })

  describe('endAgentContextSessions', () => {
    test('Returns early and does not release a session if the agent context correlation id matches the root agent context', async () => {
      const rootAgentContextMock = {
        contextCorrelationId: 'mock',
        dependencyManager: { dispose: jest.fn() },
      } as unknown as AgentContext
      await tenantSessionCoordinator.endAgentContextSession(rootAgentContextMock)

      expect(tenantSessionMutexMock.releaseSession).not.toHaveBeenCalled()
    })

    test('throws an error if not agent context session exists for the tenant', async () => {
      const tenantAgentContextMock = { contextCorrelationId: 'does-not-exist' } as unknown as AgentContext
      expect(tenantSessionCoordinator.endAgentContextSession(tenantAgentContextMock)).rejects.toThrowError(
        `Unknown agent context with contextCorrelationId 'does-not-exist'. Cannot end session`
      )
    })

    test('decreases the tenant session count and calls release session', async () => {
      const tenant1AgentContext = { contextCorrelationId: 'tenant1' } as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: withTimeout(new Mutex(), 0),
        sessionCount: 2,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        tenant1,
      }

      await tenantSessionCoordinator.endAgentContextSession(tenant1AgentContext)

      // Should have reduced session count by one
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenant1AgentContext,
        mutex: tenant1.mutex,
        sessionCount: 1,
      })
      expect(tenantSessionMutexMock.releaseSession).toHaveBeenCalledTimes(1)
    })

    test('closes the agent context and removes the agent context mapping if the number of sessions reaches 0', async () => {
      const tenant1AgentContext = {
        dependencyManager: { dispose: jest.fn() },
        contextCorrelationId: 'tenant1',
      } as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: withTimeout(new Mutex(), 0),
        sessionCount: 1,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        tenant1,
      }

      await tenantSessionCoordinator.endAgentContextSession(tenant1AgentContext)

      // Should have removed tenant1
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toBeUndefined()
      expect(tenant1AgentContext.dependencyManager.dispose).toHaveBeenCalledTimes(1)
      expect(tenantSessionMutexMock.releaseSession).toHaveBeenCalledTimes(1)
    })
  })
})
