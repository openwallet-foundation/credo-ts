import type { ModulesMap } from '@credo-ts/core'
import type { TenantsModule } from '@credo-ts/tenants'

import { Agent, LogLevel, utils } from '@credo-ts/core'

import { TestLogger, agentDependencies, createDidKidVerificationMethod } from '../../core/tests'

export async function createAgentFromModules<MM extends ModulesMap>(label: string, modulesMap: MM, secretKey: string) {
  const agent = new Agent<MM>({
    config: { label, walletConfig: { id: utils.uuid(), key: utils.uuid() }, logger: new TestLogger(LogLevel.off) },
    dependencies: agentDependencies,
    modules: modulesMap,
  })

  await agent.initialize()
  const data = await createDidKidVerificationMethod(agent.context, secretKey)

  return {
    ...data,
    agent,
  }
}

export type AgentType<MM extends ModulesMap> = Awaited<ReturnType<typeof createAgentFromModules<MM>>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentWithTenantsModule = Agent<{ tenants: TenantsModule<any> }>

export async function createTenantForAgent(
  // FIXME: we need to make some improvements on the agent typing. It'a quite hard
  // to get it right at the moment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: AgentWithTenantsModule & any,
  label: string
) {
  const tenantRecord = await agent.modules.tenants.createTenant({
    config: {
      label,
    },
  })

  const tenant = await agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id })
  const data = await createDidKidVerificationMethod(tenant)
  await tenant.endSession()

  return {
    ...data,
    tenantId: tenantRecord.id,
  }
}

export type TenantType = Awaited<ReturnType<typeof createTenantForAgent>>
