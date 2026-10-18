import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, createRecordEncodingSchema, utils, zTypedObject } from '@credo-ts/core'
import { z } from 'zod'

export interface AnonCredsCredentialDefinitionPrivateRecordProps {
  id?: string
  credentialDefinitionId: string
  value: Record<string, unknown>
  createdAt?: Date
}

export type DefaultAnonCredsCredentialDefinitionPrivateTags = {
  credentialDefinitionId: string
}

const anonCredsCredentialDefinitionPrivateRecordEncodingSchema = createRecordEncodingSchema({
  credentialDefinitionId: z.string().optional(),
  value: zTypedObject<Record<string, unknown>>().optional(),
})

export class AnonCredsCredentialDefinitionPrivateRecord extends BaseRecord<
  DefaultAnonCredsCredentialDefinitionPrivateTags,
  TagsBase
> {
  public static get encodingSchema() {
    return anonCredsCredentialDefinitionPrivateRecordEncodingSchema
  }

  public static readonly type = 'AnonCredsCredentialDefinitionPrivateRecord'
  public readonly type = AnonCredsCredentialDefinitionPrivateRecord.type

  public readonly credentialDefinitionId!: string
  public readonly value!: Record<string, unknown> // TODO: Define structure

  public constructor(props: AnonCredsCredentialDefinitionPrivateRecordProps) {
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
