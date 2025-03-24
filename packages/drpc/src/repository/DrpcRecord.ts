import type { RecordTags, TagsBase } from '@credo-ts/core'
import type { DrpcRequest, DrpcResponse } from '../messages'
import type { DrpcRole, DrpcState } from '../models'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'

export type CustomDrpcMessageTags = TagsBase
export type DefaultDrpcMessageTags = {
  connectionId: string
  threadId: string
}

export type DrpcMessageTags = RecordTags<DrpcRecord>

export interface DrpcStorageProps {
  id?: string
  connectionId: string
  role: DrpcRole
  tags?: CustomDrpcMessageTags
  request?: DrpcRequest
  response?: DrpcResponse
  state: DrpcState
  threadId: string
}

export class DrpcRecord extends BaseRecord<DefaultDrpcMessageTags, CustomDrpcMessageTags> {
  public request?: DrpcRequest
  public response?: DrpcResponse
  public connectionId!: string
  public role!: DrpcRole
  public state!: DrpcState
  public threadId!: string

  public static readonly type = 'DrpcRecord'
  public readonly type = DrpcRecord.type

  public constructor(props: DrpcStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.request = props.request
      this.response = props.response
      this.connectionId = props.connectionId
      this._tags = props.tags ?? {}
      this.role = props.role
      this.state = props.state
      this.threadId = props.threadId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      connectionId: this.connectionId,
      threadId: this.threadId,
    }
  }

  public assertRole(expectedRole: DrpcRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Invalid DRPC record role ${this.role}, expected is ${expectedRole}.`)
    }
  }

  public assertState(expectedStates: DrpcState | DrpcState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `DRPC response record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
