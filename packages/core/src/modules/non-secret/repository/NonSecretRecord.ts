import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type NonSecretRecordTags = TagsBase
export type DefaultNonSecretRecordTags = {
  connectionId: string
}

export type BasicMessageTags = RecordTags<NonSecretRecord>

export interface NonSecretRecordStorageProps {
  id?: string
  createdAt?: Date
  connectionId?: string
  tags?: NonSecretRecordTags

  content: string
}

export class NonSecretRecord extends BaseRecord<DefaultNonSecretRecordTags, NonSecretRecordTags> {
  public content!: string
  public connectionId?: string

  public static readonly type = 'NonSecretRecord'
  public readonly type = NonSecretRecord.type

  public constructor(props: NonSecretRecordStorageProps) {
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
