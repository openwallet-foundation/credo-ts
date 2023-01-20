import type { TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export interface CacheItem {
  value: unknown
  expiresAt?: number
}

export interface CacheStorageProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  entries: Array<{ key: string; item: CacheItem }>
}

export class CacheRecord extends BaseRecord {
  public entries!: Array<{ key: string; item: CacheItem }>

  public static readonly type = 'CacheRecord'
  public readonly type = CacheRecord.type

  public constructor(props: CacheStorageProps) {
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
