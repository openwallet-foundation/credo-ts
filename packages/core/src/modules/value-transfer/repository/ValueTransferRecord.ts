import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { AutoAcceptValueTransfer } from '../ValueTransferAutoAcceptType'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'
import type { Payment } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import {
  GiverReceiptMessage,
  CashAcceptedMessage,
  CashRemovedMessage,
  RequestAcceptedMessage,
  RequestMessage,
  RequestWitnessedMessage,
  RequestAcceptedWitnessedMessage,
  CashAcceptedWitnessedMessage,
  GetterReceiptMessage,
} from '../messages'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

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

  witness?: string
  getter?: string
  giver?: string

  tags?: CustomValueTransferTags
  requestMessage?: RequestMessage
  requestWitnessedMessage?: RequestWitnessedMessage
  requestAcceptedMessage?: RequestAcceptedMessage
  requestAcceptedWitnessedMessage?: RequestAcceptedWitnessedMessage
  cashAcceptedMessage?: CashAcceptedMessage
  cashAcceptedWitnessedMessage?: CashAcceptedWitnessedMessage
  cashRemovedMessage?: CashRemovedMessage
  getterReceiptMessage?: GetterReceiptMessage
  giverReceiptMessage?: GiverReceiptMessage
  rejectMessage?: ProblemReportMessage
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public witnessDid?: string
  public getterDid?: string
  public giverDid?: string

  public threadId!: string

  public payment!: Payment

  public role!: ValueTransferRole

  public state!: ValueTransferState

  @Type(() => RequestMessage)
  public requestMessage?: RequestMessage

  @Type(() => RequestWitnessedMessage)
  public requestWitnessedMessage?: RequestWitnessedMessage

  @Type(() => RequestAcceptedMessage)
  public requestAcceptedMessage?: RequestAcceptedMessage

  @Type(() => RequestAcceptedWitnessedMessage)
  public requestAcceptedWitnessedMessage?: RequestAcceptedWitnessedMessage

  @Type(() => CashAcceptedMessage)
  public cashAcceptedMessage?: CashAcceptedMessage

  @Type(() => CashAcceptedWitnessedMessage)
  public cashAcceptedWitnessedMessage?: CashAcceptedWitnessedMessage

  @Type(() => CashRemovedMessage)
  public cashRemovedMessage?: CashRemovedMessage

  @Type(() => GetterReceiptMessage)
  public getterReceiptMessage?: GetterReceiptMessage

  @Type(() => GiverReceiptMessage)
  public giverReceiptMessage?: GiverReceiptMessage

  @Type(() => ProblemReportMessage)
  public problemReportMessage?: ProblemReportMessage

  public autoAcceptValueTransfer?: AutoAcceptValueTransfer

  public static readonly type = 'ValueTransferRecord'
  public readonly type = ValueTransferRecord.type

  public constructor(props: ValueTransferStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.witnessDid = props.witness
      this.getterDid = props.getter
      this.giverDid = props.giver
      this.threadId = props.threadId
      this.role = props.role
      this.payment = props.payment
      this.state = props.state
      this.requestMessage = props.requestMessage
      this.requestWitnessedMessage = props.requestWitnessedMessage
      this.requestAcceptedMessage = props.requestAcceptedMessage
      this.requestAcceptedWitnessedMessage = props.requestAcceptedWitnessedMessage
      this.cashAcceptedMessage = props.cashAcceptedMessage
      this.cashAcceptedWitnessedMessage = props.cashAcceptedWitnessedMessage
      this.cashRemovedMessage = props.cashRemovedMessage
      this.getterReceiptMessage = props.getterReceiptMessage
      this.giverReceiptMessage = props.giverReceiptMessage
      this.problemReportMessage = props.rejectMessage
      this.autoAcceptValueTransfer = props.autoAcceptValueTransfer
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      witnessDid: this.witnessDid,
      getterDid: this.getterDid,
      giverDid: this.giverDid,
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
