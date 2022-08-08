import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'
import type { WitnessInfo } from '@sicpa-dlab/value-transfer-protocol-ts'

import { WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export type CustomWitnessStateTags = TagsBase
export type DefaultWitnessStateTags = TagsBase
export type WitnessStateTags = RecordTags<WitnessStateRecord>

export class WitnessData {
  @IsString()
  public wid!: string

  @IsString()
  public did!: string

  @IsString()
  @IsOptional()
  public type?: string
}

export interface WitnessStateProps {
  id?: string
  witnessState: WitnessState
  topWitness: WitnessData
}

export class WitnessStateRecord extends BaseRecord<DefaultWitnessStateTags, CustomWitnessStateTags> {
  public static readonly type = 'WitnessState'
  public readonly type = WitnessStateRecord.type

  @Type(() => WitnessState)
  public witnessState!: WitnessState

  @Type(() => WitnessData)
  public topWitness!: WitnessData

  public constructor(props: WitnessStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.witnessState = props.witnessState
      this.topWitness = props.topWitness
    }
  }

  public get did(): string {
    return this.witnessState.info.did
  }

  public get wid(): string {
    return this.witnessState.info.wid
  }

  public get knownWitnesses(): Array<WitnessInfo> {
    return this.witnessState.mappingTable.filter((witness) => witness.did !== this.did)
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
