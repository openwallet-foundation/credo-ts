import type { DependencyManager, Module } from '@credo-ts/core'
import type { TenantAgentContextMapping } from '../TenantSessionCoordinator'

import { AgentConfig, AgentContext } from '@credo-ts/core'
import { Mutex, withTimeout } from 'async-mutex'

import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { TenantsModuleConfig } from '../../TenantsModuleConfig'
import { TenantRecord } from '../../repository'
import { TenantSessionCoordinator } from '../TenantSessionCoordinator'
import { TenantSessionMutex } from '../TenantSessionMutex'

vi.mock('../TenantSessionMutex')
const TenantSessionMutexMock = TenantSessionMutex as MockedClassConstructor<typeof TenantSessionMutex>

// tenantAgentContextMapping is private, but we need to access it to properly test this class. Adding type override to
// make sure we don't get a lot of type errors.
type PublicTenantAgentContextMapping = Omit<TenantSessionCoordinator, 'tenantAgentContextMapping'> & {
  tenantAgentContextMapping: TenantAgentContextMapping
}

const agentContext = getAgentContext({
  agentConfig: getAgentConfig('TenantSessionCoordinator'),
})

const tenantSessionCoordinator = new TenantSessionCoordinator(
  agentContext,
  testLogger,
  new TenantsModuleConfig()
) as unknown as PublicTenantAgentContextMapping

const tenantSessionMutexMock = TenantSessionMutexMock.mock.instances[0]

describe('TenantSessionCoordinator', () => {
  afterEach(() => {
    tenantSessionCoordinator.tenantAgentContextMapping = {}
    vi.resetAllMocks()
    vi.clearAllMocks()
  })

  describe('getContextForSession', () => {
    test('returns the context from the tenantAgentContextMapping and increases the session count if already available', async () => {
      const tenant1AgentContext = vi.fn() as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: new Mutex(),
        sessionCount: 1,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        'tenant-tenant1': tenant1,
      }

      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
        },
        storageVersion: '0.5',
      })

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)
      expect(tenantSessionMutexMock.acquireSession).toHaveBeenCalledTimes(1)
      expect(tenantAgentContext).toBe(tenant1AgentContext)
      expect(tenant1.sessionCount).toBe(2)
    })

    test('creates a new agent context, initializes the wallet and stores it in the tenant agent context mapping', async () => {
      const agentContext = getAgentContext({
        agentConfig: getAgentConfig('TenantSessionCoordinator'),
      })

      const tenantSessionCoordinator = new TenantSessionCoordinator(
        agentContext,
        testLogger,
        new TenantsModuleConfig()
      ) as unknown as PublicTenantAgentContextMapping

      const tenantSessionMutexMock = TenantSessionMutexMock.mock.instances[0]

      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
        },
        storageVersion: '0.5',
      })
      const createChildSpy = vi.spyOn(agentContext.dependencyManager, 'createChild')
      const extendSpy = vi.spyOn(agentContext.config, 'extend')

      const tenantDependencyManager = {
        registerInstance: vi.fn(),
        initializeAgentContext: vi.fn(),
      } as unknown as DependencyManager

      createChildSpy.mockReturnValue(tenantDependencyManager)

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)

      expect(tenantSessionMutexMock.acquireSession).toHaveBeenCalledTimes(1)
      expect(extendSpy).toHaveBeenCalledWith({})
      expect(createChildSpy).toHaveBeenCalledWith()
      expect(tenantDependencyManager.registerInstance).toHaveBeenCalledWith(AgentContext, expect.any(AgentContext))
      expect(tenantDependencyManager.registerInstance).toHaveBeenCalledWith(AgentConfig, expect.any(AgentConfig))

      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toEqual({
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

      expect(tenantAgentContext.contextCorrelationId).toBe('tenant-tenant1')
      createChildSpy.mockClear()
      createChildSpy.mockReset()
    })

    test('locks and waits for lock to release when initialization is already in progress', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
        },
        storageVersion: '0.5',
      })

      let hasBeenCalledTimes = 0

      const { ...originalModules } = agentContext.dependencyManager.registeredModules
      agentContext.dependencyManager.registerModules({
        test2: new (class implements Module {
          async onInitializeContext(_agentContext: AgentContext): Promise<void> {
            hasBeenCalledTimes++
            await new Promise((res) => setTimeout(res, 500))
          }

          register(_dependencyManager: DependencyManager): void {}
        })(),
      })

      // Start two context session creations (but don't await). It should set the mutex property on the tenant agent context mapping.
      const tenantAgentContext1Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      const tenantAgentContext2Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toBeUndefined()

      // Await first session promise, should have 1 session
      const tenantAgentContext1 = await tenantAgentContext1Promise
      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toEqual({
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
      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toEqual({
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
      expect(hasBeenCalledTimes).toEqual(1)

      // @ts-ignore
      agentContext.dependencyManager.registeredModules = originalModules
      expect(tenantAgentContext1).toBe(tenantAgentContext2)
    })
  })

  describe('endAgentContextSessions', () => {
    test('Returns early and does not release a session if the agent context correlation id matches the root agent context', async () => {
      const rootAgentContextMock = {
        contextCorrelationId: 'mock',
        dependencyManager: { dispose: vi.fn() },
        isRootAgentContext: true,
      } as unknown as AgentContext
      await tenantSessionCoordinator.endAgentContextSession(rootAgentContextMock)

      expect(tenantSessionMutexMock.releaseSession).not.toHaveBeenCalled()
    })

    test('throws an error if no agent context session exists for the tenant', async () => {
      const tenantAgentContextMock = { contextCorrelationId: 'tenant-does-not-exist' } as unknown as AgentContext
      await expect(tenantSessionCoordinator.endAgentContextSession(tenantAgentContextMock)).rejects.toThrow(
        `Unknown agent context with contextCorrelationId 'tenant-does-not-exist'. Cannot end session`
      )
    })

    test('decreases the tenant session count and calls release session', async () => {
      const tenant1AgentContext = { contextCorrelationId: 'tenant-tenant1' } as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: withTimeout(new Mutex(), 0),
        sessionCount: 2,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        'tenant-tenant1': tenant1,
      }

      await tenantSessionCoordinator.endAgentContextSession(tenant1AgentContext)

      // Should have reduced session count by one
      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toEqual({
        agentContext: tenant1AgentContext,
        mutex: tenant1.mutex,
        sessionCount: 1,
      })
      expect(tenantSessionMutexMock.releaseSession).toHaveBeenCalledTimes(1)
    })

    test('closes the agent context and removes the agent context mapping if the number of sessions reaches 0', async () => {
      const tenant1AgentContext = {
        dependencyManager: { closeAgentContext: vi.fn() },
        contextCorrelationId: 'tenant-tenant1',
      } as unknown as AgentContext

      const tenant1 = {
        agentContext: tenant1AgentContext,
        mutex: withTimeout(new Mutex(), 0),
        sessionCount: 1,
      }
      tenantSessionCoordinator.tenantAgentContextMapping = {
        'tenant-tenant1': tenant1,
      }

      await tenantSessionCoordinator.endAgentContextSession(tenant1AgentContext)

      // Should have removed tenant1
      expect(tenantSessionCoordinator.tenantAgentContextMapping['tenant-tenant1']).toBeUndefined()
      expect(tenant1AgentContext.dependencyManager.closeAgentContext).toHaveBeenCalledTimes(1)
      expect(tenantSessionMutexMock.releaseSession).toHaveBeenCalledTimes(1)
    })
  })
})
