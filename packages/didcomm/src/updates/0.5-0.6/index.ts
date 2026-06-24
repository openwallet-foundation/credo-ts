import type { BaseAgent } from '@credo-ts/core'

import { migrateConnectionRecordToV0_6 } from './connectionRecord'

export async function updateV0_5ToV0_6<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateConnectionRecordToV0_6(agent)
}
