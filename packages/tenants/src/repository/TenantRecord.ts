import type { TenantConfig } from '../models/TenantConfig'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { BaseRecord, utils } from '@credo-ts/core'

export type TenantRecordTags = RecordTags<TenantRecord>

export interface TenantRecordProps {
  id?: string
  createdAt?: Date
  config: TenantConfig
  tags?: TagsBase
}

export class TenantRecord extends BaseRecord {
  public static readonly type = 'TenantRecord'
  public readonly type = TenantRecord.type

  public config!: TenantConfig

  public constructor(props: TenantRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.config = props.config
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
