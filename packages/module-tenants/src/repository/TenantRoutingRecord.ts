import type { RecordTags, TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export type TenantRoutingRecordTags = RecordTags<TenantRoutingRecord>

type DefaultTenantRoutingRecordTags = {
  tenantId: string
  recipientKeyFingerprint: string
}

export interface TenantRoutingRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  tenantId: string
  recipientKeyFingerprint: string
}

export class TenantRoutingRecord extends BaseRecord<DefaultTenantRoutingRecordTags> {
  public static readonly type = 'TenantRoutingRecord'
  public readonly type = TenantRoutingRecord.type

  public tenantId!: string
  public recipientKeyFingerprint!: string

  public constructor(props: TenantRoutingRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.tenantId = props.tenantId
      this.recipientKeyFingerprint = props.recipientKeyFingerprint
    }
  }

  public getTags() {
    return {
      ...this._tags,
      tenantId: this.tenantId,
      recipientKeyFingerprint: this.recipientKeyFingerprint,
    }
  }
}
