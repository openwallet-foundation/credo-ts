import type { DrpcRole } from '../DrpcRole'
import type { DrpcRequestMessage, DrpcResponseMessage } from '../messages'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { BaseRecord, utils } from '@credo-ts/core'

export type CustomDrpcMessageTags = TagsBase
export type DefaultBasicMessageTags = {
  connectionId: string
  role: DrpcRole
}

export type DrpcMessageTags = RecordTags<DrpcMessageRecord>

export interface DrpcMessageStorageProps {
  id?: string
  connectionId: string
  role: DrpcRole
  tags?: CustomDrpcMessageTags
  content: DrpcRequestMessage | DrpcResponseMessage
}

export class DrpcMessageRecord extends BaseRecord<DefaultBasicMessageTags, CustomDrpcMessageTags> {
  public content!: DrpcRequestMessage | DrpcResponseMessage
  public connectionId!: string
  public role!: DrpcRole

  public static readonly type = 'DrpcMessageRecord'
  public readonly type = DrpcMessageRecord.type

  public constructor(props: DrpcMessageStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
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
