import type { InitConfig } from '@credo-ts/core'

// TODO: remove label from tenant config
export type TenantConfig = Pick<InitConfig, 'label'>
