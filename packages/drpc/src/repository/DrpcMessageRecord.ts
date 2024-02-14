import type { DrpcRole } from '../DrpcRole'
import type { DrpcState } from '../DrpcState'
import type { DrpcRequest, DrpcResponse } from '../messages'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'

export type CustomDrpcMessageTags = TagsBase
export type DefaultDrpcMessageTags = {
  connectionId: string
  threadId: string
}

export type DrpcMessageTags = RecordTags<DrpcMessageRecord>

export interface DrpcMessageStorageProps {
  id?: string
  connectionId: string
  role: DrpcRole
  tags?: CustomDrpcMessageTags
  message: DrpcRequest | DrpcResponse
  state: DrpcState
  threadId: string
}

export class DrpcMessageRecord extends BaseRecord<DefaultDrpcMessageTags, CustomDrpcMessageTags> {
  public message!: DrpcRequest | DrpcResponse
  public connectionId!: string
  public role!: DrpcRole
  public state!: DrpcState
  public threadId!: string

  public static readonly type = 'DrpcMessageRecord'
  public readonly type = DrpcMessageRecord.type

  public constructor(props: DrpcMessageStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.message = props.message
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
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `DRPC response record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
