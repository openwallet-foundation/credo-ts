import type { ModulesMap, UpdateAssistantUpdateOptions } from '@credo-ts/core'
import type { TenantAgent } from './TenantAgent'
import type { TenantConfig } from './models/TenantConfig'

export interface GetTenantAgentOptions {
  tenantId: string
}

export type WithTenantAgentCallback<AgentModules extends ModulesMap, Return> = (
  tenantAgent: TenantAgent<AgentModules>
) => Promise<Return>

export interface CreateTenantOptions {
  config: Omit<TenantConfig, 'walletConfig'>
}

export interface UpdateTenantStorageOptions {
  tenantId: string
  updateOptions?: UpdateAssistantUpdateOptions
}
