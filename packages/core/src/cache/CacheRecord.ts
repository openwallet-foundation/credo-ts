import type { RecordTags, TagsBase } from '../storage/BaseRecord'

import { BaseRecord } from '../storage/BaseRecord'
import { uuid } from '../utils/uuid'

export type CustomCacheTags = TagsBase
export type DefaultCacheTags = TagsBase

export type CacheTags = RecordTags<CacheRecord>

export interface CacheStorageProps {
  id?: string
  createdAt?: Date
  tags?: CustomCacheTags

  entries: Array<{ key: string; value: unknown }>
}

export class CacheRecord extends BaseRecord<DefaultCacheTags, CustomCacheTags> {
  public entries!: Array<{ key: string; value: unknown }>

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
