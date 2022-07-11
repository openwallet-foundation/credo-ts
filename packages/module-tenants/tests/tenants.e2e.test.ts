import type { InitConfig } from '@aries-framework/core'

import { OutOfBandRecord, Agent, DependencyManager } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import testLogger from '../../core/tests/logger'
import { TenantsApi, TenantsModule } from '../src'

jest.setTimeout(2000000)

const agent1Config: InitConfig = {
  label: 'Tenant Agent 1',
  walletConfig: {
    id: 'Wallet: tenants e2e agent 1',
    key: 'Wallet: tenants e2e agent 1',
  },
  logger: testLogger,
  endpoints: ['rxjs:tenant-agent1'],
  autoAcceptConnections: true,
}

const agent2Config: InitConfig = {
  label: 'Tenant Agent 2',
  walletConfig: {
    id: 'Wallet: tenants e2e agent 2',
    key: 'Wallet: tenants e2e agent 2',
  },
  logger: testLogger,
  endpoints: ['rxjs:tenant-agent2'],
  autoAcceptConnections: true,
}

// Register tenant module. For now we need to create a custom dependency manager
// and register all plugins before initializing the agent. Later, we can add the module registration
// to the agent constructor.
const agent1DependencyManager = new DependencyManager()
agent1DependencyManager.registerModules(TenantsModule)

const agent2DependencyManager = new DependencyManager()
agent2DependencyManager.registerModules(TenantsModule)

// Create multi-tenant agents
const agent1 = new Agent(agent1Config, agentDependencies, agent1DependencyManager)
const agent2 = new Agent(agent2Config, agentDependencies, agent2DependencyManager)

// Register inbound and outbound transports (so we can communicate with ourselves)
const agent1InboundTransport = new SubjectInboundTransport()
const agent2InboundTransport = new SubjectInboundTransport()

agent1.registerInboundTransport(agent1InboundTransport)
agent2.registerInboundTransport(agent2InboundTransport)

agent1.registerOutboundTransport(
  new SubjectOutboundTransport({
    'rxjs:tenant-agent1': agent1InboundTransport.ourSubject,
    'rxjs:tenant-agent2': agent2InboundTransport.ourSubject,
  })
)
agent2.registerOutboundTransport(
  new SubjectOutboundTransport({
    'rxjs:tenant-agent1': agent1InboundTransport.ourSubject,
    'rxjs:tenant-agent2': agent2InboundTransport.ourSubject,
  })
)

const agent1TenantsApi = agent1.dependencyManager.resolve(TenantsApi)
const agent2TenantsApi = agent2.dependencyManager.resolve(TenantsApi)

describe('Tenants E2E', () => {
  beforeAll(async () => {
    await agent1.initialize()
    await agent2.initialize()
  })

  afterAll(async () => {
    await agent1.wallet.delete()
    await agent1.shutdown()
    await agent2.wallet.delete()
    await agent2.shutdown()
  })

  test('create get and delete a tenant', async () => {
    // Create tenant
    let tenantRecord1 = await agent1TenantsApi.createTenant({
      config: {
        label: 'Tenant 1',
      },
    })

    // Retrieve tenant record from storage
    tenantRecord1 = await agent1TenantsApi.getTenantById(tenantRecord1.id)

    // Get tenant agent
    const tenantAgent = await agent1TenantsApi.getTenantAgent({
      tenantId: tenantRecord1.id,
    })
    await tenantAgent.shutdown()

    // Delete tenant agent
    await agent1TenantsApi.deleteTenantById(tenantRecord1.id)

    // Can not get tenant agent again
    await expect(agent1TenantsApi.getTenantAgent({ tenantId: tenantRecord1.id })).rejects.toThrow(
      `TenantRecord: record with id ${tenantRecord1.id} not found.`
    )
  })

  test('create a connection between two tenants within the same agent', async () => {
    // Create tenants
    const tenantRecord1 = await agent1TenantsApi.createTenant({
      config: {
        label: 'Tenant 1',
      },
    })
    const tenantRecord2 = await agent1TenantsApi.createTenant({
      config: {
        label: 'Tenant 2',
      },
    })

    const tenantAgent1 = await agent1TenantsApi.getTenantAgent({
      tenantId: tenantRecord1.id,
    })
    const tenantAgent2 = await agent1TenantsApi.getTenantAgent({
      tenantId: tenantRecord2.id,
    })

    // Create and receive oob invitation in scope of tenants
    const outOfBandRecord = await tenantAgent1.oob.createInvitation()
    const { connectionRecord: tenant2ConnectionRecord } = await tenantAgent2.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation
    )

    // Retrieve all oob records for the base and tenant agent, only the
    // tenant agent should have a record.
    const baseAgentOutOfBandRecords = await agent1.oob.getAll()
    const tenantAgent1OutOfBandRecords = await tenantAgent1.oob.getAll()
    const tenantAgent2OutOfBandRecords = await tenantAgent2.oob.getAll()

    expect(baseAgentOutOfBandRecords.length).toBe(0)
    expect(tenantAgent1OutOfBandRecords.length).toBe(1)
    expect(tenantAgent2OutOfBandRecords.length).toBe(1)

    if (!tenant2ConnectionRecord) throw new Error('Receive invitation did not return connection record')
    await tenantAgent2.connections.returnWhenIsConnected(tenant2ConnectionRecord.id)

    // Find the connection record for the created oob invitation
    const [connectionRecord] = await tenantAgent1.connections.findAllByOutOfBandId(outOfBandRecord.id)
    await tenantAgent1.connections.returnWhenIsConnected(connectionRecord.id)

    await tenantAgent1.shutdown()
    await tenantAgent1.shutdown()

    // Delete tenants (will also delete wallets)
    await agent1TenantsApi.deleteTenantById(tenantAgent1.context.contextCorrelationId)
    await agent1TenantsApi.deleteTenantById(tenantAgent2.context.contextCorrelationId)
  })

  test('create a connection between two tenants within different agents', async () => {
    // Create tenants
    const tenantRecord1 = await agent1TenantsApi.createTenant({
      config: {
        label: 'Agent 1 Tenant 1',
      },
    })
    const tenantAgent1 = await agent1TenantsApi.getTenantAgent({
      tenantId: tenantRecord1.id,
    })

    const tenantRecord2 = await agent2TenantsApi.createTenant({
      config: {
        label: 'Agent 2 Tenant 1',
      },
    })
    const tenantAgent2 = await agent2TenantsApi.getTenantAgent({
      tenantId: tenantRecord2.id,
    })

    // Create and receive oob invitation in scope of tenants
    const outOfBandRecord = await tenantAgent1.oob.createInvitation()
    const { connectionRecord: tenant2ConnectionRecord } = await tenantAgent2.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation
    )

    if (!tenant2ConnectionRecord) throw new Error('Receive invitation did not return connection record')
    await tenantAgent2.connections.returnWhenIsConnected(tenant2ConnectionRecord.id)

    // Find the connection record for the created oob invitation
    const [connectionRecord] = await tenantAgent1.connections.findAllByOutOfBandId(outOfBandRecord.id)
    await tenantAgent1.connections.returnWhenIsConnected(connectionRecord.id)

    await tenantAgent1.shutdown()
    await tenantAgent1.shutdown()

    // Delete tenants (will also delete wallets)
    await agent1TenantsApi.deleteTenantById(tenantRecord1.id)
    await agent2TenantsApi.deleteTenantById(tenantRecord2.id)
  })

  test('perform actions within the callback of withTenantAgent', async () => {
    const tenantRecord = await agent1TenantsApi.createTenant({
      config: {
        label: 'Agent 1 Tenant 1',
      },
    })

    await agent1TenantsApi.withTenantAgent({ tenantId: tenantRecord.id }, async (tenantAgent) => {
      const outOfBandRecord = await tenantAgent.oob.createInvitation()

      expect(outOfBandRecord).toBeInstanceOf(OutOfBandRecord)
      expect(tenantAgent.context.contextCorrelationId).toBe(tenantRecord.id)
      expect(tenantAgent.config.label).toBe('Agent 1 Tenant 1')
    })

    await agent1TenantsApi.deleteTenantById(tenantRecord.id)
  })
})
