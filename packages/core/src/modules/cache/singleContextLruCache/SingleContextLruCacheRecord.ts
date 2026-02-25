import { Type } from 'class-transformer'
import type { TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

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

export class SingleContextLruCacheRecord extends BaseRecord {
  @Type(() => Object)
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
