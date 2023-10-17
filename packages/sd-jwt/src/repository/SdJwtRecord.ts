import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export type SdJwtRecordTags = TagsBase

export type SdJwtRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: SdJwtRecordTags
  sdJwt: string
}

export type SaveSdJwtRecordOptions = {
  id?: string
  sdJwt: string
  tags?: SdJwtRecordTags
}

export class SdJwtRecord extends BaseRecord<SdJwtRecordTags> {
  /*
   * @todo storing compact is not permanent
   */
  public sdJwt!: string

  public static readonly type = 'SdJwtRecord'
  public readonly type = SdJwtRecord.type

  public constructor(props: SdJwtRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.sdJwt = props.sdJwt
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
