import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { DidInfo } from '../../well-known'
import type { ValueTransferRole } from '../ValueTransferRole'
import type { ValueTransferState } from '../ValueTransferState'

import { Receipt } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsOptional } from 'class-validator'

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

export enum ValueTransferTransactionStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Finished = 'finished',
}

export interface ValueTransferStorageProps {
  id?: string
  role: ValueTransferRole
  state: ValueTransferState
  threadId: string
  createdAt?: Date

  getter?: DidInfo
  giver?: DidInfo
  witness?: DidInfo
  problemReportMessage?: ProblemReportMessage
  receipt: Receipt

  status?: ValueTransferTransactionStatus
  tags?: CustomValueTransferTags

  attachment?: Record<string, unknown>
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  public witness?: DidInfo
  public getter?: DidInfo
  public giver?: DidInfo

  public threadId!: string

  public role!: ValueTransferRole

  public state!: ValueTransferState
  public status?: ValueTransferTransactionStatus

  @Type(() => Receipt)
  public receipt!: Receipt

  @Type(() => ProblemReportMessage)
  public problemReportMessage?: ProblemReportMessage

  public static readonly type = 'ValueTransferRecord'
  public readonly type = ValueTransferRecord.type

  @IsOptional()
  public attachment?: Record<string, unknown>

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
      this.receipt = props.receipt
      this.problemReportMessage = props.problemReportMessage
      this.attachment = props.attachment
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
      txnId: this.receipt?.txn_id,
      role: this.role,
      state: this.state,
      status: this.status,
    }
  }

  public get givenTotal() {
    return this.receipt.given_total
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
