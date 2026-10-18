import type { TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { createRecordEncodingSchema } from '../../../storage/recordEncodingSchema'
import { uuid } from '../../../utils/uuid'
import { zTypedObject } from '../../../utils/zod'

export type GenericRecordTags = TagsBase

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

const genericRecordEncodingSchema = createRecordEncodingSchema({
  content: zTypedObject<Record<string, unknown>>().optional(),
})

export class GenericRecord extends BaseRecord<GenericRecordTags> {
  public static get encodingSchema() {
    return genericRecordEncodingSchema
  }

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
