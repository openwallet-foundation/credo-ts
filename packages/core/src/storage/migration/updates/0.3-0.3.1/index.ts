import type { BaseAgent } from '../../../../agent/BaseAgent'

import { migrateDidRecordToV0_3_1 } from './did'

export async function updateV0_3ToV0_3_1<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateDidRecordToV0_3_1(agent)
}
