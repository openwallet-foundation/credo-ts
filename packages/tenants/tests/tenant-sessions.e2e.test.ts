import type { InitConfig } from '@aries-framework/core'
import type { TenantRecord } from '@aries-framework/tenants'

import { ConnectionsModule, Agent } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import { AskarModule, AskarMultiWalletDatabaseScheme } from '../../askar/src'
import { ariesAskar } from '../../askar/tests/helpers'
import { getAskarWalletConfig, testLogger } from '../../core/tests'

import { TenantsModule } from '@aries-framework/tenants'

const agentConfig: InitConfig = {
  label: 'Tenant Agent 1',
  walletConfig: getAskarWalletConfig('tenant sessions e2e agent 1', { inMemory: false, maxConnections: 100 }),
  logger: testLogger,
  endpoints: ['rxjs:tenant-agent1'],
}

// Create multi-tenant agent
const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    tenants: new TenantsModule({ sessionAcquireTimeout: 10000 }),
    askar: new AskarModule({
      ariesAskar,
      multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
    }),
    connections: new ConnectionsModule({
      autoAcceptConnections: true,
    }),
  },
})

describe('Tenants Sessions E2E', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.wallet.delete()
    await agent.shutdown()
  })

  test('create 100 sessions in parallel for the same tenant and close them', async () => {
    const numberOfSessions = 100

    const tenantRecord = await agent.modules.tenants.createTenant({
      config: {
        label: 'Agent 1 Tenant 1',
      },
    })

    const tenantAgentPromises = []

    for (let session = 0; session < numberOfSessions; session++) {
      tenantAgentPromises.push(agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id }))
    }

    const tenantAgents = await Promise.all(tenantAgentPromises)

    await Promise.all(tenantAgents.map((tenantAgent) => tenantAgent.endSession()))
  })

  // FIXME: when creating the 100 tenants in parallel, it will error out with askar.
  // For now I've fixed it by creating the tenants sequentially, but still opening all
  // the sessions in parallel. However it should be fine to create the tenants in parallel
  // as well, and this should be fixed in askar / AFJs wallet implementation around askar
  test('create 5 sessions each for 20 tenants in parallel and close them', async () => {
    const numberOfTenants = 20
    const numberOfSessions = 5

    const tenantRecordPromises = []
    for (let tenantNo = 0; tenantNo < numberOfTenants; tenantNo++) {
      const tenantRecordPromise = agent.modules.tenants.createTenant({
        config: {
          label: 'Agent 1 Tenant 1',
        },
      })

      tenantRecordPromises.push(tenantRecordPromise)
    }

    let tenantRecords: TenantRecord[] = []
    try {
      tenantRecords = await Promise.all(tenantRecordPromises)
    } catch (error) {
      console.log(error.cause.code)
      throw error
    }
    const tenantAgentPromises = []
    for (const tenantRecord of tenantRecords) {
      for (let session = 0; session < numberOfSessions; session++) {
        tenantAgentPromises.push(agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id }))
      }
    }

    const tenantAgents = await Promise.all(tenantAgentPromises)

    await Promise.all(tenantAgents.map((tenantAgent) => tenantAgent.endSession()))
  })
})
