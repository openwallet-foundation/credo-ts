import type { ModulesMap, UpdateAssistantUpdateOptions } from '@credo-ts/core'
import type { TenantConfig } from './models/TenantConfig'
import type { TenantAgent } from './TenantAgent'

export interface GetTenantAgentOptions {
  tenantId: string

  /**
   * Whether a session can be opened for a tenant that is inactive. By default sessions
   * can only be opened for active tenants.
   *
   * @default false
   */
  allowInactive?: boolean
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
