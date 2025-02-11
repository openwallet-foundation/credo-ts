import type { BaseRecord, BaseRecordConstructor, Query, TagsBase } from '@credo-ts/core'
import type { EntryObject } from '@openwallet-foundation/askar-shared'

import { JsonTransformer } from '@credo-ts/core'

export function recordToInstance<T extends BaseRecord>(record: EntryObject, recordClass: BaseRecordConstructor<T>): T {
  const instance = JsonTransformer.deserialize<T>(record.value as string, recordClass)
  instance.id = record.name

  const tags = record.tags ? transformToRecordTagValues(record.tags) : {}
  instance.replaceTags(tags)

  return instance
}

export function transformToRecordTagValues(tags: Record<string, unknown>): TagsBase {
  const transformedTags: TagsBase = {}

  for (const [key, value] of Object.entries(tags)) {
    // If the value is a boolean string ('1' or '0')
    // use the boolean val
    if (value === '1' && key?.includes(':')) {
      const [tagName, ...tagValues] = key.split(':')
      const tagValue = tagValues.join(':')

      const transformedValue = transformedTags[tagName]

      if (Array.isArray(transformedValue)) {
        transformedTags[tagName] = [...transformedValue, tagValue]
      } else {
        transformedTags[tagName] = [tagValue]
      }
    }
    // Transform '1' and '0' to boolean
    else if (value === '1' || value === '0') {
      transformedTags[key] = value === '1'
    }
    // If 1 or 0 is prefixed with 'n__' we need to remove it. This is to prevent
    // casting the value to a boolean
    else if (value === 'n__1' || value === 'n__0') {
      transformedTags[key] = value === 'n__1' ? '1' : '0'
    }
    // Otherwise just use the value
    else {
      transformedTags[key] = value as string
    }
  }

  return transformedTags
}

export function transformFromRecordTagValues(tags: TagsBase): { [key: string]: string | undefined } {
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
      value.forEach((item) => {
        const tagName = `${key}:${item}`
        transformedTags[tagName] = '1'
      })
    }
    // Otherwise just use the value
    else {
      transformedTags[key] = value
    }
  }

  return transformedTags
}

/**
 * Transforms the search query into a wallet query compatible with Askar WQL.
 *
 * The format used by Credo is almost the same as the WQL query, with the exception of
 * the encoding of values, however this is handled by the {@link AskarStorageServiceUtil.transformToRecordTagValues}
 * method.
 */
export function askarQueryFromSearchQuery<T extends BaseRecord>(query: Query<T>): Record<string, unknown> {
  // eslint-disable-next-line prefer-const
  let { $and, $or, $not, ...tags } = query

  $and = ($and as Query<T>[] | undefined)?.map((q) => askarQueryFromSearchQuery(q))
  $or = ($or as Query<T>[] | undefined)?.map((q) => askarQueryFromSearchQuery(q))
  $not = $not ? askarQueryFromSearchQuery($not as Query<T>) : undefined

  const askarQuery = {
    ...transformFromRecordTagValues(tags as unknown as TagsBase),
    $and,
    $or,
    $not,
  }

  return askarQuery
}
