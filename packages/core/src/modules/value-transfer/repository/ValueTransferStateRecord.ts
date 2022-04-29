import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { ValueTransferState } from '../ValueTransferState'
import type { VerifiableNote } from '@value-transfer/value-transfer-lib'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomValueTransferStateTags = TagsBase
export type DefaultValueTransferStateTags = TagsBase

export type ValueTransferStateTags = RecordTags<ValueTransferStateRecord>

export interface ValueTransferStateProps {
  id?: string
  publicDid: string
  previousHash: string
  verifiableNotes: Array<VerifiableNote>
}

export class ValueTransferStateRecord extends BaseRecord<DefaultValueTransferStateTags, CustomValueTransferStateTags> {
  public previousHash!: string
  public verifiableNotes!: Array<VerifiableNote>
  public publicDid!: string

  public static readonly type = 'ValueTransferState'
  public readonly type = ValueTransferStateRecord.type

  public constructor(props: ValueTransferStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicDid = props.publicDid
      this.previousHash = props.previousHash
      this.verifiableNotes = props.verifiableNotes
    }
  }

  public getTags() {
    return {
      ...this._tags,
      publicDid: this.publicDid,
    }
  }
}
