import type { KeyType } from '@aries-framework/core'

import { KeyAlgs } from 'aries-askar-test-shared'

export const keyTypeSupportedByAskar = (keyType: KeyType) =>
  Object.entries(KeyAlgs).find(([, value]) => value === keyType.toString()) !== undefined
