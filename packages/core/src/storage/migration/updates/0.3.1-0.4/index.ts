import type { BaseAgent } from '../../../../agent/BaseAgent'

import { migrateCacheToV0_4 } from './cache'
import { migrateDidRecordToV0_4 } from './did'
import { migrateW3cCredentialRecordToV0_4 } from './w3cCredentialRecord'

export async function updateV0_3_1ToV0_4<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateDidRecordToV0_4(agent)
  await migrateCacheToV0_4(agent)
  await migrateW3cCredentialRecordToV0_4(agent)
}
