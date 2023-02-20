import type { InitConfig } from '@aries-framework/core'

import { Agent } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import { testLogger, indySdk } from '../../core/tests'
import { IndySdkModule } from '../../indy-sdk/src'

import { TenantsModule } from '@aries-framework/tenants'

const agentConfig: InitConfig = {
  label: 'Tenant Agent 1',
  walletConfig: {
    id: 'Wallet: tenant sessions e2e agent 1',
    key: 'Wallet: tenant sessions e2e agent 1',
  },
  logger: testLogger,
  endpoints: ['rxjs:tenant-agent1'],
  autoAcceptConnections: true,
}

// Create multi-tenant agent
const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    tenants: new TenantsModule({ sessionAcquireTimeout: 10000 }),
    indySdk: new IndySdkModule({ indySdk }),
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

  test('create 5 sessions each for 20 tenants in parallel and close them', async () => {
    const numberOfTenants = 20
    const numberOfSessions = 5

    const tenantRecordPromises = []
    for (let tenantNo = 0; tenantNo < numberOfTenants; tenantNo++) {
      const tenantRecord = agent.modules.tenants.createTenant({
        config: {
          label: 'Agent 1 Tenant 1',
        },
      })

      tenantRecordPromises.push(tenantRecord)
    }

    const tenantRecords = await Promise.all(tenantRecordPromises)

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
