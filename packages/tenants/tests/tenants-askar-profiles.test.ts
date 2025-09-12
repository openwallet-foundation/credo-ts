import type { InitConfig } from '@credo-ts/core'

import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

import { AskarModule, AskarMultiWalletDatabaseScheme } from '../../askar/src'
import { getAskarStoreConfig, testLogger } from '../../core/tests'

import { TenantsModule } from '@credo-ts/tenants'
import { Store, askar } from '@openwallet-foundation/askar-nodejs'
import { AskarStoreManager } from '../../askar/src/AskarStoreManager'

describe('Tenants Askar database schemes E2E', () => {
  test('uses AskarWallet for all wallets and tenants when database schema is DatabasePerWallet', async () => {
    const agentConfig: InitConfig = {
      logger: testLogger,
    }

    // Create multi-tenant agent
    const agent = new Agent({
      config: agentConfig,
      modules: {
        tenants: new TenantsModule(),
        askar: new AskarModule({
          askar,
          store: getAskarStoreConfig('askar tenants without profiles e2e agent 1', { inMemory: false }),
          // Database per wallet
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.DatabasePerWallet,
        }),
      },
      dependencies: agentDependencies,
    })

    await agent.initialize()

    // Create tenant
    const tenantRecord = await agent.modules.tenants.createTenant({
      config: {
        label: 'Tenant 1',
      },
    })

    // Get tenant agent
    const tenantAgent = await agent.modules.tenants.getTenantAgent({
      tenantId: tenantRecord.id,
    })

    const rootStore = agent.dependencyManager.resolve(Store)
    const tenantStore = tenantAgent.dependencyManager.resolve(Store)

    // By default, profile is the same as the wallet id
    expect(await tenantStore.getDefaultProfile()).toEqual(`tenant-${tenantRecord.id}`)
    // But the store should be different
    expect(tenantStore).not.toBe(rootStore)

    // Insert and end
    await tenantAgent.genericRecords.save({ content: { name: 'hello' }, id: 'hello' })
    await tenantAgent.endSession()

    const tenantAgent2 = await agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id })
    expect(await tenantAgent2.genericRecords.findById('hello')).not.toBeNull()

    await agent.shutdown()
  })

  test('uses AskarWallet for main agent, and ProfileAskarWallet for tenants', async () => {
    const agentConfig: InitConfig = {
      logger: testLogger,
    }

    // Create multi-tenant agent
    const agent = new Agent({
      config: agentConfig,
      modules: {
        tenants: new TenantsModule(),
        askar: new AskarModule({
          askar,
          store: getAskarStoreConfig('askar tenants with profiles e2e agent 1'),
          // Profile per wallet
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
        }),
      },
      dependencies: agentDependencies,
    })

    await agent.initialize()

    // Create tenant
    const tenantRecord = await agent.modules.tenants.createTenant({
      config: {
        label: 'Tenant 1',
      },
    })

    // Get tenant agent
    const tenantAgent = await agent.modules.tenants.getTenantAgent({
      tenantId: tenantRecord.id,
    })

    const rootStore = agent.dependencyManager.resolve(Store)
    const tenantStore = tenantAgent.dependencyManager.resolve(Store)

    const storeManager = agent.dependencyManager.resolve(AskarStoreManager)

    const rootStoreWithProfile = await storeManager.getInitializedStoreWithProfile(agent.context)
    const tenantStoreWithProfile = await storeManager.getInitializedStoreWithProfile(tenantAgent.context)

    expect(tenantStoreWithProfile.profile).toEqual(`tenant-${tenantRecord.id}`)
    expect(tenantStoreWithProfile.store).toEqual(rootStoreWithProfile.store)

    expect(rootStoreWithProfile.profile).toEqual(undefined)

    // When using profile, the wallets should share the same store
    expect(tenantStore).toBe(rootStore)

    await agent.shutdown()
  })
})
