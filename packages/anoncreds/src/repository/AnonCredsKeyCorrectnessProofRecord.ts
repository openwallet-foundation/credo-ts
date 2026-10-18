import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, createRecordEncodingSchema, utils, zTypedObject } from '@credo-ts/core'
import { z } from 'zod'

export interface AnonCredsKeyCorrectnessProofRecordProps {
  id?: string
  credentialDefinitionId: string
  value: Record<string, unknown>
  createdAt?: Date
}

export type DefaultAnonCredsKeyCorrectnessProofPrivateTags = {
  credentialDefinitionId: string
}

const anonCredsKeyCorrectnessProofRecordEncodingSchema = createRecordEncodingSchema({
  credentialDefinitionId: z.string().nullish(),
  value: zTypedObject<Record<string, unknown>>().nullish(),
})

export class AnonCredsKeyCorrectnessProofRecord extends BaseRecord<
  DefaultAnonCredsKeyCorrectnessProofPrivateTags,
  TagsBase
> {
  public static get encodingSchema(): z.ZodType {
    return anonCredsKeyCorrectnessProofRecordEncodingSchema
  }

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
      this.createdAt = props.createdAt ?? new Date()
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinitionId,
    }
  }
}
