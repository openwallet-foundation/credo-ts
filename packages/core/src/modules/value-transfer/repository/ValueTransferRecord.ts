import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'

import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { RequestMessage } from '../messages'

import { AriesFrameworkError } from '@aries-framework/core'
import {
  CashAcceptedMessage,
  CashRemovedMessage,
  ReceiptMessage,
  RequestAcceptedMessage,
} from '@value-transfer/value-transfer-lib'

export type CustomValueTransferTags = TagsBase
export type DefaultValueTransferTags = {
  threadId: string
  role: ValueTransferRole
}

export type ValueTransferTags = RecordTags<ValueTransferRecord>

export interface ValueTransferStorageProps {
  id?: string
  createdAt?: Date
  state: ValueTransferState
  connectionId?: string
  role: ValueTransferRole
  threadId: string

  tags?: CustomValueTransferTags
  requestMessage?: RequestMessage
  requestAcceptedMessage?: RequestAcceptedMessage
  cashAcceptedMessage?: CashAcceptedMessage
  cashRemovedMessage?: CashRemovedMessage
  receiptMessage?: ReceiptMessage
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public connectionId?: string
  public threadId!: string
  public role!: ValueTransferRole
  public state!: ValueTransferState

  @Type(() => RequestMessage)
  public requestMessage?: RequestMessage

  @Type(() => RequestAcceptedMessage)
  public requestAcceptedMessage?: RequestAcceptedMessage

  @Type(() => CashAcceptedMessage)
  public cashAcceptedMessage?: CashAcceptedMessage

  @Type(() => CashRemovedMessage)
  public cashRemovedMessage?: CashRemovedMessage

  @Type(() => ReceiptMessage)
  public receiptMessage?: ReceiptMessage

  public static readonly type = 'ValueTransferRecord'
  public readonly type = ValueTransferRecord.type

  public constructor(props: ValueTransferStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this._tags = props.tags ?? {}
      this.role = props.role
      this.state = props.state
      this.requestMessage = props.requestMessage
      this.requestAcceptedMessage = props.requestAcceptedMessage
      this.cashAcceptedMessage = props.cashAcceptedMessage
      this.cashRemovedMessage = props.cashRemovedMessage
      this.receiptMessage = props.receiptMessage
    }
  }

  public getTags() {
    return {
      ...this._tags,
      threadId: this.threadId,
      role: this.role,
    }
  }

  public assertState(expectedStates: ValueTransferState | ValueTransferState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Credential record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (!this.connectionId) {
      throw new AriesFrameworkError(
        `Credential record is not associated with any connection. This is often the case with connection-less credential exchange`
      )
    } else if (this.connectionId !== currentConnectionId) {
      throw new AriesFrameworkError(
        `Credential record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
