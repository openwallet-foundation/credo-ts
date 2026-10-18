import { z } from 'zod'
import type { TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { createRecordEncodingSchema } from '../../../storage/recordEncodingSchema'
import { uuid } from '../../../utils/uuid'
import { zMapFromObject } from '../../../utils/zod'

export interface SingleContextLruCacheItem {
  value: unknown
  expiresAt?: number
}

export interface SingleContextLruCacheProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  entries: Map<string, SingleContextLruCacheItem>
}

const singleContextLruCacheRecordEncodingSchema = createRecordEncodingSchema({
  entries: zMapFromObject(
    z.looseObject({
      value: z.unknown(),
      expiresAt: z.number().optional(),
    })
  ).optional(),
})

export class SingleContextLruCacheRecord extends BaseRecord {
  public static get encodingSchema(): z.ZodType {
    return singleContextLruCacheRecordEncodingSchema
  }

  public entries!: Map<string, SingleContextLruCacheItem>

  public static readonly type = 'SingleContextLruCacheRecord'
  public readonly type = SingleContextLruCacheRecord.type

  public constructor(props: SingleContextLruCacheProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.entries = props.entries
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
