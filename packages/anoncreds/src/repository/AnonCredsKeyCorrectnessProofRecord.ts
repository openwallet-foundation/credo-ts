import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsKeyCorrectnessProofRecordProps {
  id?: string
  credentialDefinitionId: string
  value: Record<string, unknown>
}

export type DefaultAnonCredsKeyCorrectnessProofPrivateTags = {
  credentialDefinitionId: string
}

export class AnonCredsKeyCorrectnessProofRecord extends BaseRecord<
  DefaultAnonCredsKeyCorrectnessProofPrivateTags,
  TagsBase
> {
  public static readonly type = 'AnonCredsKeyCorrectnessProofRecord'
  public readonly type = AnonCredsKeyCorrectnessProofRecord.type

  public readonly credentialDefinitionId!: string
  public readonly value!: Record<string, unknown> // TODO: Define structure

  public constructor(props: AnonCredsKeyCorrectnessProofRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialDefinitionId = props.credentialDefinitionId
      this.value = props.value
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinitionId,
    }
  }
}
