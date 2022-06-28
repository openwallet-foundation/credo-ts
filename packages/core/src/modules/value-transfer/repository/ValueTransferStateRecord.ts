import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { PartyState } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomValueTransferStateTags = TagsBase
export type DefaultValueTransferStateTags = TagsBase
export type ValueTransferStateTags = RecordTags<ValueTransferStateRecord>

export interface ValueTransferStateProps {
  id?: string
  publicDid?: string
  partyState: PartyState
}

export class ValueTransferStateRecord extends BaseRecord<DefaultValueTransferStateTags, CustomValueTransferStateTags> {
  public publicDid?: string

  @Type(() => PartyState)
  public partyState!: PartyState

  public static readonly type = 'ValueTransferState'
  public readonly type = ValueTransferStateRecord.type

  public constructor(props: ValueTransferStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicDid = props.publicDid
      this.partyState = props.partyState
    }
  }

  public getTags() {
    return {
      ...this._tags,
      publicDid: this.publicDid,
    }
  }
}
