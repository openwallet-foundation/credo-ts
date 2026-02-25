import type { ModulesMap, UpdateAssistantUpdateOptions } from '@credo-ts/core'
import type { TenantConfig } from './models/TenantConfig'
import type { TenantAgent } from './TenantAgent'

export interface GetTenantAgentOptions {
  tenantId: string
}

export type WithTenantAgentCallback<AgentModules extends ModulesMap, Return> = (
  tenantAgent: TenantAgent<AgentModules>
) => Promise<Return>

export interface CreateTenantOptions {
  config: TenantConfig
}

export interface UpdateTenantStorageOptions {
  tenantId: string
  updateOptions?: UpdateAssistantUpdateOptions
}
