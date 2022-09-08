import type { BaseAgent } from '../../../../agent/BaseAgent'

import { migrateProofRecordToV0_3 } from './proof'

export async function updateV0_2ToV0_3<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateProofRecordToV0_3(agent)
}
