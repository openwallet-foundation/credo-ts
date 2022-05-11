import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { AutoAcceptValueTransfer } from '../ValueTransferAutoAcceptType'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'
import type { Payment } from '@value-transfer/value-transfer-lib'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import {
  ReceiptMessage,
  CashAcceptedMessage,
  CashRemovedMessage,
  RequestAcceptedMessage,
  RequestMessage,
} from '../messages'
import { RejectMessage } from '../messages/RejectMessage'

export type CustomValueTransferTags = TagsBase
export type DefaultValueTransferTags = {
  threadId: string
  role: ValueTransferRole
}

export type ValueTransferTags = RecordTags<ValueTransferRecord>

export interface ValueTransferStorageProps {
  id?: string
  payment: Payment
  role: ValueTransferRole
  state: ValueTransferState
  threadId: string
  createdAt?: Date
  autoAcceptValueTransfer?: AutoAcceptValueTransfer
  witnessConnectionId?: string
  getterConnectionId?: string
  giverConnectionId?: string

  tags?: CustomValueTransferTags
  requestMessage?: RequestMessage
  requestAcceptedMessage?: RequestAcceptedMessage
  cashAcceptedMessage?: CashAcceptedMessage
  cashRemovedMessage?: CashRemovedMessage
  receiptMessage?: ReceiptMessage
  rejectMessage?: RejectMessage
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public witnessConnectionId?: string
  public getterConnectionId?: string
  public giverConnectionId?: string

  public threadId!: string

  public payment!: Payment

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

  @Type(() => RejectMessage)
  public rejectMessage?: RejectMessage

  public autoAcceptValueTransfer?: AutoAcceptValueTransfer

  public static readonly type = 'ValueTransferRecord'
  public readonly type = ValueTransferRecord.type

  public constructor(props: ValueTransferStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.witnessConnectionId = props.witnessConnectionId
      this.getterConnectionId = props.getterConnectionId
      this.giverConnectionId = props.giverConnectionId
      this.threadId = props.threadId
      this.role = props.role
      this.payment = props.payment
      this.state = props.state
      this.requestMessage = props.requestMessage
      this.requestAcceptedMessage = props.requestAcceptedMessage
      this.cashAcceptedMessage = props.cashAcceptedMessage
      this.cashRemovedMessage = props.cashRemovedMessage
      this.receiptMessage = props.receiptMessage
      this.rejectMessage = props.rejectMessage
      this.autoAcceptValueTransfer = props.autoAcceptValueTransfer
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      witnessConnectionId: this.witnessConnectionId,
      getterConnectionId: this.getterConnectionId,
      giverConnectionId: this.giverConnectionId,
      threadId: this.threadId,
      txnId: this.payment?.txId,
      role: this.role,
    }
  }

  public assertRole(expectedRoles: ValueTransferRole | ValueTransferRole[]) {
    if (!Array.isArray(expectedRoles)) {
      expectedRoles = [expectedRoles]
    }

    if (!expectedRoles.includes(this.role)) {
      throw new AriesFrameworkError(
        `Value Transfer record has an unexpected role ${this.role}. Valid roles are: ${expectedRoles.join(', ')}.`
      )
    }
  }

  public assertState(expectedStates: ValueTransferState | ValueTransferState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Value Transfer record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
