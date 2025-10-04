import type { FileSystem, InitConfig } from '@credo-ts/core'

import path from 'path'
import { Agent, CacheModule, InMemoryLruCache, InjectionSymbols, UpdateAssistant } from '@credo-ts/core'
import { DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'

import { AskarModule, AskarMultiWalletDatabaseScheme } from '../../askar/src'
import { askar } from '../../askar/tests/helpers'
import { testLogger } from '../../core/tests'
import { TenantSessionCoordinator } from '../src/context/TenantSessionCoordinator'

import { TenantsModule } from '@credo-ts/tenants'

const agentConfig = {
  logger: testLogger,
} satisfies InitConfig

const modules = {
  didcomm: new DidCommModule({
    connections: {
      autoAcceptConnections: true,
    },
  }),
  tenants: new TenantsModule(),
  askar: new AskarModule({
    askar,
    multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
    store: {
      id: 'tenants-agent-04',
      key: 'tenants-agent-04',
    },
  }),
  cache: new CacheModule({
    cache: new InMemoryLruCache({ limit: 500 }),
  }),
} as const

describe('Tenants Storage Update', () => {
  test('auto update storage', async () => {
    // Create multi-tenant agents
    const agent = new Agent({
      config: {
        ...agentConfig,
        autoUpdateStorageOnStartup: true,
      },
      modules,
      dependencies: agentDependencies,
    })

    // Delete existing wallet at this path
    const fileSystem = agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    await fileSystem.delete(path.join(fileSystem.dataPath, 'wallet', modules.askar.config.store.id))

    const askarStoreConfig = agent.modules.askar.config.store
    await agent.modules.askar.importStore({
      importFromStore: {
        id: askarStoreConfig.id,
        key: askarStoreConfig.key,
        keyDerivationMethod: askarStoreConfig.keyDerivationMethod,
        database: { type: 'sqlite', config: { path: path.join(__dirname, 'tenants-04.db') } },
      },
    })
    await agent.initialize()

    // Expect tenant storage version to be still 0.4
    const tenant = await agent.modules.tenants.getTenantById('1d45d3c2-3480-4375-ac6f-47c322f091b0')
    expect(tenant.storageVersion).toBe('0.4')

    // Open/close tenant agent so that the storage is updated
    await (
      await agent.modules.tenants.getTenantAgent({ tenantId: '1d45d3c2-3480-4375-ac6f-47c322f091b0' })
    ).endSession()

    // Expect tenant storage version to be 0.5
    const updatedTenant = await agent.modules.tenants.getTenantById('1d45d3c2-3480-4375-ac6f-47c322f091b0')
    expect(updatedTenant.storageVersion).toBe('0.5')

    await agent.shutdown()
  })

  test('error when trying to open session for tenant when autoUpdateStorageOnStartup is disabled', async () => {
    // Create multi-tenant agents
    const agent = new Agent({
      config: agentConfig,
      modules,
      dependencies: agentDependencies,
    })

    // Delete existing wallet at this path
    const fileSystem = agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    await fileSystem.delete(path.join(fileSystem.dataPath, 'wallet', modules.askar.config.store.id))

    const askarStoreConfig = agent.modules.askar.config.store
    await agent.modules.askar.importStore({
      importFromStore: {
        id: askarStoreConfig.id,
        key: askarStoreConfig.key,
        keyDerivationMethod: askarStoreConfig.keyDerivationMethod,
        database: { type: 'sqlite', config: { path: path.join(__dirname, 'tenants-04.db') } },
      },
    })

    // Update root agent (but not tenants)
    const updateAssistant = new UpdateAssistant(agent)
    await updateAssistant.initialize()
    await updateAssistant.update()

    // Initialize agent
    await agent.initialize()

    // Expect tenant storage version to be still 0.4
    const tenant = await agent.modules.tenants.getTenantById('1d45d3c2-3480-4375-ac6f-47c322f091b0')
    expect(tenant.storageVersion).toBe('0.4')

    // Should throw error because not up to date and autoUpdateStorageOnStartup is not true
    await expect(
      agent.modules.tenants.getTenantAgent({ tenantId: '1d45d3c2-3480-4375-ac6f-47c322f091b0' })
    ).rejects.toThrow(/Current agent storage for tenant 1d45d3c2-3480-4375-ac6f-47c322f091b0 is not up to date/)

    await agent.shutdown()
  })

  test('update tenant agent manually using update assistant', async () => {
    // Create multi-tenant agents
    const agent = new Agent({
      config: agentConfig,
      modules,
      dependencies: agentDependencies,
    })

    // Delete existing wallet at this path
    const fileSystem = agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    await fileSystem.delete(path.join(fileSystem.dataPath, 'wallet', modules.askar.config.store.id))

    const askarStoreConfig = agent.modules.askar.config.store
    await agent.modules.askar.importStore({
      importFromStore: {
        id: askarStoreConfig.id,
        key: askarStoreConfig.key,
        keyDerivationMethod: askarStoreConfig.keyDerivationMethod,
        database: { type: 'sqlite', config: { path: path.join(__dirname, 'tenants-04.db') } },
      },
    })

    // Update root agent (but not tenants)
    const updateAssistant = new UpdateAssistant(agent)
    await updateAssistant.initialize()
    await updateAssistant.update()

    // Initialize agent
    await agent.initialize()

    // Expect tenant storage version to be still 0.4
    const tenant = await agent.modules.tenants.getTenantById('1d45d3c2-3480-4375-ac6f-47c322f091b0')
    expect(tenant.storageVersion).toBe('0.4')

    // Getting tenant should now throw error because not up to date
    await expect(
      agent.modules.tenants.getTenantAgent({ tenantId: '1d45d3c2-3480-4375-ac6f-47c322f091b0' })
    ).rejects.toThrow(/Current agent storage for tenant 1d45d3c2-3480-4375-ac6f-47c322f091b0 is not up to date/)

    const tenantSessionCoordinator = agent.dependencyManager.resolve(TenantSessionCoordinator)
    expect(tenantSessionCoordinator.getSessionCountForTenant(tenant.id)).toBe(0)

    // Update tenant
    await agent.modules.tenants.updateTenantStorage({
      tenantId: tenant.id,
    })

    // Should have closed session after upgrade
    expect(tenantSessionCoordinator.getSessionCountForTenant(tenant.id)).toBe(0)

    // Expect tenant storage version to be 0.5
    const updatedTenant = await agent.modules.tenants.getTenantById('1d45d3c2-3480-4375-ac6f-47c322f091b0')
    expect(updatedTenant.storageVersion).toBe('0.5')

    // Getting tenant should now work
    await expect(
      agent.modules.tenants.withTenantAgent({ tenantId: '1d45d3c2-3480-4375-ac6f-47c322f091b0' }, async () => {
        /* no-op */
      })
    ).resolves.toBeUndefined()

    const outdatedTenants = await agent.modules.tenants.getTenantsWithOutdatedStorage()
    expect(outdatedTenants).toHaveLength(2)

    // Update tenants in parallel
    const updatePromises = outdatedTenants.map((tenant) =>
      agent.modules.tenants.updateTenantStorage({
        tenantId: tenant.id,
      })
    )

    await Promise.all(updatePromises)

    // Now there should be no outdated tenants
    const outdatedTenantsAfterUpdate = await agent.modules.tenants.getTenantsWithOutdatedStorage()
    expect(outdatedTenantsAfterUpdate).toHaveLength(0)

    await agent.shutdown()
  })
})
