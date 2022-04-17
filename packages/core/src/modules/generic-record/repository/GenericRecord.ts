import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type GenericRecordTags = TagsBase
export type DefaultGenericRecordTags = {
  connectionId: string
}

export type BasicMessageTags = RecordTags<GenericRecord>

export interface GenericRecordStorageProps {
  id?: string
  createdAt?: Date
  connectionId?: string
  tags?: GenericRecordTags

  content: string
}

export class GenericRecord extends BaseRecord<DefaultGenericRecordTags, GenericRecordTags> {
  public content!: string
  public connectionId?: string

  public static readonly type = 'NonSecretRecord'
  public readonly type = GenericRecord.type

  public constructor(props: GenericRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.content = props.content
      this.connectionId = props.connectionId
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      connectionId: this.connectionId ?? 'NONE',
    }
  }
}
