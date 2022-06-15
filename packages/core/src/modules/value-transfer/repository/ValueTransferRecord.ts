import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { DidInfo } from '../../well-known'
import type { AutoAcceptValueTransfer } from '../ValueTransferAutoAcceptType'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ProblemReportMessage } from '../messages'

export type CustomValueTransferTags = TagsBase
export type DefaultValueTransferTags = {
  threadId: string
  role: ValueTransferRole
}

export type ValueTransferTags = RecordTags<ValueTransferRecord>

export enum ValueTransferRecordStatus {
  Pending = 'pending',
  Active = 'active',
  Finished = 'finished',
}

export interface ValueTransferStorageProps {
  id?: string
  role: ValueTransferRole
  state: ValueTransferState
  threadId: string
  createdAt?: Date
  autoAcceptValueTransfer?: AutoAcceptValueTransfer

  getter?: DidInfo
  giver?: DidInfo
  witness?: DidInfo
  valueTransferMessage: ValueTransferMessage
  problemReportMessage?: ProblemReportMessage
  receipt?: ValueTransferMessage

  status?: ValueTransferRecordStatus
  tags?: CustomValueTransferTags
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public witness?: DidInfo
  public getter?: DidInfo
  public giver?: DidInfo

  public threadId!: string

  public role!: ValueTransferRole

  public state!: ValueTransferState
  public status?: ValueTransferRecordStatus

  @Type(() => ValueTransferMessage)
  public valueTransferMessage!: ValueTransferMessage

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
      this.witness = props.witness
      this.getter = props.getter
      this.giver = props.giver
      this.threadId = props.threadId
      this.role = props.role
      this.state = props.state
      this.status = props.status
      this.valueTransferMessage = props.valueTransferMessage
      this.receipt = props.receipt
      this.problemReportMessage = props.problemReportMessage
      this.autoAcceptValueTransfer = props.autoAcceptValueTransfer
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      witnessDid: this.witness?.did,
      getterDid: this.getter?.did,
      giverDid: this.giver?.did,
      threadId: this.threadId,
      txnId: this.valueTransferMessage?.txnId,
      role: this.role,
      state: this.state,
      status: this.status,
    }
  }

  public get givenTotal() {
    return this.valueTransferMessage.payment.given_total
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
