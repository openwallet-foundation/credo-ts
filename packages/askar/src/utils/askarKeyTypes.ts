import type { KeyType } from '@aries-framework/core'

import { KeyAlgs } from '@hyperledger/aries-askar-shared'

export const keyTypeSupportedByAskar = (keyType: KeyType) =>
  Object.entries(KeyAlgs).find(([, value]) => value === keyType.toString()) !== undefined
