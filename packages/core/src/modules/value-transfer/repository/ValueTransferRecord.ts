import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { AutoAcceptValueTransfer } from '../ValueTransferAutoAcceptType'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ProblemReportMessage, RequestMessage, RequestWitnessedMessage } from '../messages'

export type CustomValueTransferTags = TagsBase
export type DefaultValueTransferTags = {
  threadId: string
  role: ValueTransferRole
}

export type ValueTransferTags = RecordTags<ValueTransferRecord>

export interface ValueTransferStorageProps {
  id?: string
  role: ValueTransferRole
  state: ValueTransferState
  threadId: string
  createdAt?: Date
  autoAcceptValueTransfer?: AutoAcceptValueTransfer

  getter: string
  giver?: string
  witness?: string

  tags?: CustomValueTransferTags
  valueTransferMessage: ValueTransferMessage
  requestMessage?: RequestMessage
  requestWitnessedMessage?: RequestWitnessedMessage
  receipt?: ValueTransferMessage
  problemReportMessage?: ProblemReportMessage
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public witnessDid?: string
  public getterDid?: string
  public giverDid?: string

  public threadId!: string

  public role!: ValueTransferRole

  public state!: ValueTransferState

  @Type(() => ValueTransferMessage)
  public valueTransferMessage!: ValueTransferMessage

  @Type(() => RequestMessage)
  public requestMessage?: RequestMessage

  @Type(() => RequestWitnessedMessage)
  public requestWitnessedMessage?: RequestWitnessedMessage

  @Type(() => ValueTransferMessage)
  public receipt?: ValueTransferMessage

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
      this.state = props.state
      this.valueTransferMessage = props.valueTransferMessage
      this.requestMessage = props.requestMessage
      this.requestWitnessedMessage = props.requestWitnessedMessage
      this.receipt = props.receipt
      this.problemReportMessage = props.problemReportMessage
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
      txnId: this.valueTransferMessage?.payment.txId,
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
