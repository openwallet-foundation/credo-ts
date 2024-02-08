import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { DRPCMessageRole } from '../DRPCMessageRole'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { DRPCRequestMessage, DRPCRequestObject, DRPCResponseMessage, DRPCResponseObject } from '../messages'

export type CustomDRPCMessageTags = TagsBase
export type DefaultBasicMessageTags = {
  connectionId: string
  role: DRPCMessageRole
}

export type DRPCMessageTags = RecordTags<DRPCMessageRecord>

export interface DRPCMessageStorageProps {
  id?: string
  connectionId: string
  role: DRPCMessageRole
  tags?: CustomDRPCMessageTags
  content: DRPCRequestMessage | DRPCResponseMessage
}

export class DRPCMessageRecord extends BaseRecord<DefaultBasicMessageTags, CustomDRPCMessageTags> {
  public content!: DRPCRequestMessage | DRPCResponseMessage
  public connectionId!: string
  public role!: DRPCMessageRole

  public static readonly type = 'DRPCMessageRecord'
  public readonly type = DRPCMessageRecord.type

  public constructor(props: DRPCMessageStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.content = props.content
      this.connectionId = props.connectionId
      this._tags = props.tags ?? {}
      this.role = props.role
    }
  }

  public getTags() {
    return {
      ...this._tags,
      connectionId: this.connectionId,
      role: this.role,
    }
  }
}
