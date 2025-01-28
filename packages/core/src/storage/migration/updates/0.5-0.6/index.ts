import type { BaseAgent } from '../../../../agent/BaseAgent'

import { migrateToCredoFolder } from './migrateToCredoFolder'

export async function updateV0_5ToV0_6<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateToCredoFolder(agent)
}
