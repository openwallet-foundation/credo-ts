import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomWitnessStateTags = TagsBase
export type DefaultWitnessStateTags = TagsBase
export type WitnessStateTags = RecordTags<WitnessStateRecord>

export interface WitnessStateProps {
  id?: string
  publicDid: string
  witnessState: WitnessState
}

export class WitnessStateRecord extends BaseRecord<DefaultWitnessStateTags, CustomWitnessStateTags> {
  public publicDid!: string

  @Type(() => WitnessState)
  public witnessState!: WitnessState

  public static readonly type = 'WitnessState'
  public readonly type = WitnessStateRecord.type

  public constructor(props: WitnessStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicDid = props.publicDid
      this.witnessState = props.witnessState
    }
  }

  public getTags() {
    return {
      ...this._tags,
      publicDid: this.publicDid,
    }
  }
}
