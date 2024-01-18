import type { BaseAgent } from '@aries-framework/core'

import { storeAnonCredsInW3cFormatV0_5 } from './anonCredsCredentialRecord'

export async function updateAnonCredsModuleV0_4_1ToV0_5<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await storeAnonCredsInW3cFormatV0_5(agent)
}
