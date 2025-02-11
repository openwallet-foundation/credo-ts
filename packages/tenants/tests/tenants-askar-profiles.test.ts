import type { InitConfig } from '@credo-ts/core'

import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

import { AskarModule, AskarMultiWalletDatabaseScheme, AskarProfileWallet, AskarWallet } from '../../askar/src'
import { askarModuleConfig } from '../../askar/tests/helpers'
import { getAskarWalletConfig, testLogger } from '../../core/tests'

import { TenantsModule } from '@credo-ts/tenants'

describe('Tenants Askar database schemes E2E', () => {
  test('uses AskarWallet for all wallets and tenants when database schema is DatabasePerWallet', async () => {
    const agentConfig: InitConfig = {
      label: 'Tenant Agent 1',
      walletConfig: getAskarWalletConfig('askar tenants without profiles e2e agent 1', { inMemory: false }),
      logger: testLogger,
    }

    // Create multi-tenant agent
    const agent = new Agent({
      config: agentConfig,
      modules: {
        tenants: new TenantsModule(),
        askar: new AskarModule({
          askar: askarModuleConfig.askar,
          // Database per wallet
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.DatabasePerWallet,
        }),
      },
      dependencies: agentDependencies,
    })

    await agent.initialize()

    // main wallet should use AskarWallet
    expect(agent.context.wallet).toBeInstanceOf(AskarWallet)
    const mainWallet = agent.context.wallet as AskarWallet

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

    expect(tenantAgent.context.wallet).toBeInstanceOf(AskarWallet)
    const tenantWallet = tenantAgent.context.wallet as AskarWallet

    // By default, profile is the same as the wallet id
    expect(tenantWallet.profile).toEqual(`tenant-${tenantRecord.id}`)
    // But the store should be different
    expect(tenantWallet.store).not.toBe(mainWallet.store)

    // Insert and end
    await tenantAgent.genericRecords.save({ content: { name: 'hello' }, id: 'hello' })
    await tenantAgent.endSession()

    const tenantAgent2 = await agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id })
    expect(await tenantAgent2.genericRecords.findById('hello')).not.toBeNull()

    await agent.wallet.delete()
    await agent.shutdown()
  })

  test('uses AskarWallet for main agent, and ProfileAskarWallet for tenants', async () => {
    const agentConfig: InitConfig = {
      label: 'Tenant Agent 1',
      walletConfig: getAskarWalletConfig('askar tenants with profiles e2e agent 1'),
      logger: testLogger,
    }

    // Create multi-tenant agent
    const agent = new Agent({
      config: agentConfig,
      modules: {
        tenants: new TenantsModule(),
        askar: new AskarModule({
          askar: askarModuleConfig.askar,
          // Profile per wallet
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
        }),
      },
      dependencies: agentDependencies,
    })

    await agent.initialize()

    // main wallet should use AskarWallet
    expect(agent.context.wallet).toBeInstanceOf(AskarWallet)
    const mainWallet = agent.context.wallet as AskarWallet

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

    expect(tenantAgent.context.wallet).toBeInstanceOf(AskarProfileWallet)
    const tenantWallet = tenantAgent.context.wallet as AskarProfileWallet

    expect(tenantWallet.profile).toEqual(`tenant-${tenantRecord.id}`)
    // When using profile, the wallets should share the same store
    expect(tenantWallet.store).toBe(mainWallet.store)

    await agent.wallet.delete()
    await agent.shutdown()
  })
})
