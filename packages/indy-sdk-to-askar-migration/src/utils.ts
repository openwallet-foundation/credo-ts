import type { TagsBase } from '@credo-ts/core'

import { KeyDerivationMethod } from '@credo-ts/core'
import { KdfMethod, StoreKeyMethod } from '@openwallet-foundation/askar-shared'

/**
 * Adopted from `AskarStorageService` implementation and should be kept in sync.
 */
export const transformFromRecordTagValues = (tags: TagsBase): { [key: string]: string | undefined } => {
  const transformedTags: { [key: string]: string | undefined } = {}

  for (const [key, value] of Object.entries(tags)) {
    // If the value is of type null we use the value undefined
    // Askar doesn't support null as a value
    if (value === null) {
      transformedTags[key] = undefined
    }
    // If the value is a boolean use the Askar
    // '1' or '0' syntax
    else if (typeof value === 'boolean') {
      transformedTags[key] = value ? '1' : '0'
    }
    // If the value is 1 or 0, we need to add something to the value, otherwise
    // the next time we deserialize the tag values it will be converted to boolean
    else if (value === '1' || value === '0') {
      transformedTags[key] = `n__${value}`
    }
    // If the value is an array we create a tag for each array
    // item ("tagName:arrayItem" = "1")
    else if (Array.isArray(value)) {
      for (const item of value) {
        const tagName = `${key}:${item}`
        transformedTags[tagName] = '1'
      }
    }
    // Otherwise just use the value
    else {
      transformedTags[key] = value
    }
  }

  return transformedTags
}

export const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod: KeyDerivationMethod) => {
  const correspondenceTable = {
    [KeyDerivationMethod.Raw]: KdfMethod.Raw,
    [KeyDerivationMethod.Argon2IInt]: KdfMethod.Argon2IInt,
    [KeyDerivationMethod.Argon2IMod]: KdfMethod.Argon2IMod,
  }

  return new StoreKeyMethod(correspondenceTable[keyDerivationMethod])
}
