import type { BaseAgent } from '@credo-ts/core'

import { migrateTenantRecordToV0_5 } from './tenantRecord'

export async function updateTenantsModuleV0_4ToV0_5<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateTenantRecordToV0_5(agent)
}
