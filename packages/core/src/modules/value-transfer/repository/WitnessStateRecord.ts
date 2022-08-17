import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

import { WitnessInfo, WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomWitnessStateTags = TagsBase
export type DefaultWitnessStateTags = TagsBase
export type WitnessStateTags = RecordTags<WitnessStateRecord>

export interface WitnessStateProps {
  id?: string
  witnessState: WitnessState
  topWitness: WitnessInfo
}

export class WitnessStateRecord extends BaseRecord<DefaultWitnessStateTags, CustomWitnessStateTags> {
  public static readonly id = 'WitnessStateId'

  public static readonly type = 'WitnessState'
  public readonly type = WitnessStateRecord.type

  @Type(() => WitnessState)
  public witnessState!: WitnessState

  @Type(() => WitnessInfo)
  public topWitness!: WitnessInfo

  public constructor(props: WitnessStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.witnessState = props.witnessState
      this.topWitness = props.topWitness
    }
  }

  public get gossipDid(): string {
    return this.witnessState.info.gossipDid
  }

  public get publicDid(): string {
    return this.witnessState.info.publicDid
  }

  public get wid(): string {
    return this.witnessState.info.wid
  }

  public get knownWitnesses(): Array<WitnessInfo> {
    return this.witnessState.mappingTable.filter((witness) => witness.gossipDid !== this.gossipDid)
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
