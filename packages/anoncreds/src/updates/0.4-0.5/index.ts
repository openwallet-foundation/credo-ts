import type { BaseAgent } from '@credo-ts/core'

import { storeAnonCredsInW3cFormatV0_5 } from './anonCredsCredentialRecord'

export async function updateAnonCredsModuleV0_4ToV0_5<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await storeAnonCredsInW3cFormatV0_5(agent)
}
