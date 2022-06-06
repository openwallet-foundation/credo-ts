import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { Wallet } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomValueTransferStateTags = TagsBase
export type DefaultValueTransferStateTags = TagsBase

export type ValueTransferStateTags = RecordTags<ValueTransferStateRecord>

export interface ValueTransferStateProps {
  id?: string
  publicDid?: string
  previousHash: string
  wallet: Wallet
  proposedNextWallet?: Wallet
}

export class ValueTransferStateRecord extends BaseRecord<DefaultValueTransferStateTags, CustomValueTransferStateTags> {
  public previousHash!: string

  @Type(() => Wallet)
  @ValidateNested()
  @IsInstance(Wallet)
  public wallet!: Wallet

  @Type(() => Wallet)
  @ValidateNested()
  @IsInstance(Wallet)
  public proposedNextWallet?: Wallet

  public publicDid?: string

  public static readonly type = 'ValueTransferState'
  public readonly type = ValueTransferStateRecord.type

  public constructor(props: ValueTransferStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicDid = props.publicDid
      this.previousHash = props.previousHash
      this.wallet = props.wallet
      this.proposedNextWallet = props.proposedNextWallet
    }
  }

  public getTags() {
    return {
      ...this._tags,
      publicDid: this.publicDid,
    }
  }
}
