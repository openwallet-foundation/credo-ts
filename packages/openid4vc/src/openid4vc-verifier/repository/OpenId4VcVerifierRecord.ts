import type { RecordTags, TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export type OpenId4VcVerifierRecordTags = RecordTags<OpenId4VcVerifierRecord>

export type DefaultOpenId4VcVerifierRecordTags = {
  verifierId: string
}

export interface OpenId4VcVerifierRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  verifierId: string
}

export class OpenId4VcVerifierRecord extends BaseRecord<DefaultOpenId4VcVerifierRecordTags> {
  public static readonly type = 'OpenId4VcVerifierRecord'
  public readonly type = OpenId4VcVerifierRecord.type

  public verifierId!: string

  public constructor(props: OpenId4VcVerifierRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.verifierId = props.verifierId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      verifierId: this.verifierId,
    }
  }
}
