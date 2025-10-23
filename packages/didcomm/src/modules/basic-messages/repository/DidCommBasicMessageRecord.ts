import type { RecordTags, TagsBase } from '@credo-ts/core'
import { BaseRecord, utils } from '@credo-ts/core'
import type { DidCommBasicMessageRole } from '../DidCommBasicMessageRole'

export type CustomDidCommBasicMessageTags = TagsBase
export type DefaultDidCommBasicMessageTags = {
  connectionId: string
  role: DidCommBasicMessageRole
  threadId?: string
  parentThreadId?: string
}

export type DidCommBasicMessageTags = RecordTags<DidCommBasicMessageRecord>

export interface DidCommBasicMessageStorageProps {
  id?: string
  createdAt?: Date
  connectionId: string
  role: DidCommBasicMessageRole
  tags?: CustomDidCommBasicMessageTags
  threadId?: string
  parentThreadId?: string
  content: string
  sentTime: string
}

export class DidCommBasicMessageRecord extends BaseRecord<
  DefaultDidCommBasicMessageTags,
  CustomDidCommBasicMessageTags
> {
  public content!: string
  public sentTime!: string
  public connectionId!: string
  public role!: DidCommBasicMessageRole
  public threadId?: string
  public parentThreadId?: string

  public static readonly type = 'BasicMessageRecord'
  public readonly type = DidCommBasicMessageRecord.type

  public constructor(props: DidCommBasicMessageStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.content = props.content
      this.sentTime = props.sentTime
      this.connectionId = props.connectionId
      this._tags = props.tags ?? {}
      this.role = props.role
      this.threadId = props.threadId
      this.parentThreadId = props.parentThreadId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      connectionId: this.connectionId,
      role: this.role,
      threadId: this.threadId,
      parentThreadId: this.parentThreadId,
    }
  }
}
