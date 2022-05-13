import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type GenericRecordTags = TagsBase

export type BasicMessageTags = RecordTags<GenericRecord>

export interface GenericRecordStorageProps {
  id?: string
  createdAt?: Date
  tags?: GenericRecordTags
  content: Record<string, unknown>
}

export interface SaveGenericRecordOption {
  content: Record<string, unknown>
  id?: string
  tags?: GenericRecordTags
}

export class GenericRecord extends BaseRecord<GenericRecordTags> {
  public content!: Record<string, unknown>

  public static readonly type = 'GenericRecord'
  public readonly type = GenericRecord.type

  public constructor(props: GenericRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.content = props.content
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
