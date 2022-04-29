import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomWitnessStateTags = TagsBase
export type DefaultWitnessStateTags = TagsBase

export type WitnessStateTags = RecordTags<WitnessStateRecord>

export interface WitnessStateProps {
  id?: string
  publicDid: string
  stateAccumulator: string
}

export class WitnessStateRecord extends BaseRecord<DefaultWitnessStateTags, CustomWitnessStateTags> {
  public publicDid!: string
  public stateAccumulator!: string

  public static readonly type = 'WitnessState'
  public readonly type = WitnessStateRecord.type

  public constructor(props: WitnessStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicDid = props.publicDid
      this.stateAccumulator = props.stateAccumulator
    }
  }

  public getTags() {
    return {
      ...this._tags,
      publicDid: this.publicDid,
    }
  }
}
