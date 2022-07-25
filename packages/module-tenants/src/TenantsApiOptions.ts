import type { TenantAgent } from './TenantAgent'
import type { TenantConfig } from './models/TenantConfig'

export interface GetTenantAgentOptions {
  tenantId: string
}

export type WithTenantAgentCallback = (tenantAgent: TenantAgent) => Promise<void>

export interface CreateTenantOptions {
  config: Omit<TenantConfig, 'walletConfig'>
}
