import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { ValueTransferState } from '../ValueTransferState'

import { BaseRecord } from '../../../storage/BaseRecord'
import { VerifiableNote } from "@value-transfer/value-transfer-lib";

export type CustomValueTransferStateTags = TagsBase
export type DefaultValueTransferStateTags = TagsBase


export type ValueTransferStateTags = RecordTags<ValueTransferStateRecord>

export interface ValueTransferStateProps {
  previousHash: string,
  verifiableNotes: Array<VerifiableNote>,
  stateAccumulator?: string
}

export class ValueTransferStateRecord extends BaseRecord<DefaultValueTransferStateTags, CustomValueTransferStateTags> {
  public previousHash!: string
  public verifiableNotes!: Array<VerifiableNote>
  public stateAccumulator?: string

  public static readonly type = 'ValueTransferState'
  public readonly type = ValueTransferStateRecord.type

  public constructor(props: ValueTransferStateProps) {
    super()

    if (props) {
      this.previousHash = props.previousHash
      this.verifiableNotes = props.verifiableNotes
      this.stateAccumulator = props.stateAccumulator
    }
  }

  public getTags() {
    return this._tags
  }
}
