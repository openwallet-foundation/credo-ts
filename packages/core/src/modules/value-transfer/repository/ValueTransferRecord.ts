import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { TransactionRole } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Transaction } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomValueTransferTags = TagsBase
export type DefaultValueTransferTags = {
  threadId: string
  role: TransactionRole
}

export type ValueTransferTags = RecordTags<ValueTransferRecord>

export interface ValueTransferStorageProps {
  id?: string
  transaction: Transaction
  createdAt?: Date
  tags?: CustomValueTransferTags
}

export class ValueTransferRecord extends BaseRecord<DefaultValueTransferTags, CustomValueTransferTags> {
  @Type(() => Transaction)
  public transaction!: Transaction

  @IsString()
  @IsOptional()
  public secondPartyDid?: string

  @IsString()
  @IsOptional()
  public expectedRecipientDid?: string

  @IsString()
  @IsOptional()
  public usedPaymentOption?: string

  public static readonly type = 'ValueTransferRecord'
  public readonly type = ValueTransferRecord.type

  public constructor(props: ValueTransferStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.transaction = props.transaction
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      witnessDid: this.transaction.witness,
      getterDid: this.transaction.getter,
      giverDid: this.transaction.giver,
      threadId: this.transaction.threadId,
      txnId: this.transaction.receipt?.txn_id,
      role: this.transaction.role,
      state: this.transaction.state,
      status: this.transaction.status,
    }
  }

  public get givenTotal() {
    return this.transaction.receipt.given_total
  }

  public get amount() {
    return this.transaction.receipt.given_total.amount
  }

  public get unitOfAmount() {
    return this.transaction.receipt.given_total.uoa
  }

  public get state() {
    return this.transaction.state
  }

  public get status() {
    return this.transaction.status
  }

  public get receipt() {
    return this.transaction.receipt
  }

  public get error() {
    return this.transaction.error
  }
}
