import type { TenantAgentContextMapping } from '../TenantSessionCoordinator'
import type { AgentContext } from '@aries-framework/core'

import { WalletModule } from '@aries-framework/core'
import { Mutex } from 'async-mutex'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { TenantRecord } from '../../repository'
import { TenantSessionCoordinator } from '../TenantSessionCoordinator'

// tenantAgentContextMapping is private, but we need to access it to properly test this class. Adding type override to
// make sure we don't get a lot of type errors.
type PublicTenantAgentContextMapping = Omit<TenantSessionCoordinator, 'tenantAgentContextMapping'> & {
  tenantAgentContextMapping: TenantAgentContextMapping
}

const wallet = {
  initialize: jest.fn(),
} as unknown as WalletModule

const agentContext = getAgentContext({
  agentConfig: getAgentConfig('TenantSessionCoordinator'),
})

agentContext.dependencyManager.registerInstance(WalletModule, wallet)
const tenantSessionCoordinator = new TenantSessionCoordinator(
  agentContext
) as unknown as PublicTenantAgentContextMapping

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
      })

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)
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
      })

      const tenantAgentContext = await tenantSessionCoordinator.getContextForSession(tenantRecord)

      expect(wallet.initialize).toHaveBeenCalledWith(tenantRecord.config.walletConfig)
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenantAgentContext,
        sessionCount: 1,
      })

      expect(tenantAgentContext.contextCorrelationId).toBe('tenant1')
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
      })

      // Add timeout to mock the initialization and we can test that the mutex is used.
      mockFunction(wallet.initialize).mockReturnValueOnce(new Promise((resolve) => setTimeout(resolve, 100)))

      // Start two context session creations (but don't await). It should set the mutex property on the tenant agent context mapping.
      const tenantAgentContext1Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      const tenantAgentContext2Promise = tenantSessionCoordinator.getContextForSession(tenantRecord)
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        mutex: expect.any(Mutex),
      })

      // Await both context value promises
      const tenantAgentContext1 = await tenantAgentContext1Promise
      const tenantAgentContext2 = await tenantAgentContext2Promise

      // There should be two sessions active now
      expect(tenantSessionCoordinator.tenantAgentContextMapping.tenant1).toEqual({
        agentContext: tenantAgentContext1,
        sessionCount: 2,
      })

      // Initialize should only be called once
      expect(wallet.initialize).toHaveBeenCalledTimes(1)
      expect(wallet.initialize).toHaveBeenCalledWith(tenantRecord.config.walletConfig)

      expect(tenantAgentContext1).toBe(tenantAgentContext2)
    })
  })
})
