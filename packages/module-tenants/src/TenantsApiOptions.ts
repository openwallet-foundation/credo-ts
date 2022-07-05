import type { TenantConfig } from './models/TenantConfig'

export interface GetTenantAgentOptions {
  tenantId: string
}

export interface CreateTenantOptions {
  config: Omit<TenantConfig, 'walletConfig'>
}
