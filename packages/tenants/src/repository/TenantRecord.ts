import type { RecordTags, TagsBase, VersionString } from '@credo-ts/core'
import type { TenantConfig } from '../models/TenantConfig'

import { BaseRecord, utils } from '@credo-ts/core'

export type TenantRecordTags = RecordTags<TenantRecord>

export interface TenantRecordProps {
  id?: string
  createdAt?: Date
  config: TenantConfig
  tags?: TagsBase
  storageVersion: VersionString
}

export type DefaultTenantRecordTags = {
  label: string
  storageVersion: VersionString
}

export class TenantRecord extends BaseRecord<DefaultTenantRecordTags> {
  public static readonly type = 'TenantRecord'
  public readonly type = TenantRecord.type

  public config!: TenantConfig

  /**
   * The storage version that is used by this tenant. Can be used to know if the tenant is ready to be used
   * with the current version of the application.
   *
   * @default 0.4 from 0.5 onwards we set the storage version on creation, so if no value
   * is stored, it means the storage version is 0.4 (when multi-tenancy was introduced)
   */
  public storageVersion: VersionString = '0.4'

  public constructor(props: TenantRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.config = props.config
      this.storageVersion = props.storageVersion
    }
  }

  public getTags() {
    return {
      ...this._tags,
      label: this.config.label,
      storageVersion: this.storageVersion,
    }
  }
}
