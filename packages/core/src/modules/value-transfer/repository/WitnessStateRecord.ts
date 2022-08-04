import type { RecordTags, TagsBase } from '../../../storage/BaseRecord'

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
  did: string
  witnessState: WitnessState
  knownWitnesses: Array<string>
  topWitness: WitnessData
}

export class WitnessStateRecord extends BaseRecord<DefaultWitnessStateTags, CustomWitnessStateTags> {
  @Type(() => WitnessState)
  public witnessState!: WitnessState

  @IsString()
  public did!: string

  @Type(() => WitnessData)
  public topWitness!: WitnessData

  public static readonly type = 'WitnessState'
  public readonly type = WitnessStateRecord.type

  @IsString({ each: true })
  public knownWitnesses!: Array<string>

  public constructor(props: WitnessStateProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.did = props.did
      this.witnessState = props.witnessState
      this.knownWitnesses = props.knownWitnesses
      this.topWitness = props.topWitness
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
