import type { InitConfig } from '@aries-framework/core'

import { Agent, DependencyManager } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import testLogger from '../../core/tests/logger'
import { TenantsApi, TenantsModule } from '../src'

jest.setTimeout(2000000)

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

// Register tenant module. For now we need to create a custom dependency manager
// and register all plugins before initializing the agent. Later, we can add the module registration
// to the agent constructor.
const dependencyManager = new DependencyManager()
dependencyManager.registerModules(TenantsModule)

// Create multi-tenant agent
const agent = new Agent(agentConfig, agentDependencies, dependencyManager)
const agentTenantsApi = agent.dependencyManager.resolve(TenantsApi)

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

    const tenantRecord = await agentTenantsApi.createTenant({
      config: {
        label: 'Agent 1 Tenant 1',
      },
    })

    const tenantAgentPromises = []

    for (let session = 0; session < numberOfSessions; session++) {
      tenantAgentPromises.push(agentTenantsApi.getTenantAgent({ tenantId: tenantRecord.id }))
    }

    const tenantAgents = await Promise.all(tenantAgentPromises)

    await Promise.all(tenantAgents.map((tenantAgent) => tenantAgent.destroy()))
  })

  test('create 5 sessions each for 20 tenants in parallel and close them', async () => {
    const numberOfTenants = 20
    const numberOfSessions = 5

    const tenantRecordPromises = []
    for (let tenantNo = 0; tenantNo <= numberOfTenants; tenantNo++) {
      const tenantRecord = agentTenantsApi.createTenant({
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
        tenantAgentPromises.push(agentTenantsApi.getTenantAgent({ tenantId: tenantRecord.id }))
      }
    }

    const tenantAgents = await Promise.all(tenantAgentPromises)

    await Promise.all(tenantAgents.map((tenantAgent) => tenantAgent.destroy()))
  })
})
