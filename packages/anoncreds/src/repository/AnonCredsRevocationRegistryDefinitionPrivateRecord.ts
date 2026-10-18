import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, createRecordEncodingSchema, utils, zTypedObject } from '@credo-ts/core'
import { z } from 'zod'

export enum AnonCredsRevocationRegistryState {
  Created = 'created',
  Active = 'active',
  Full = 'full',
}

export interface AnonCredsRevocationRegistryDefinitionPrivateRecordProps {
  id?: string
  createdAt?: Date
  revocationRegistryDefinitionId: string
  credentialDefinitionId: string
  value: Record<string, unknown>
  state?: AnonCredsRevocationRegistryState
}

export type DefaultAnonCredsRevocationRegistryPrivateTags = {
  revocationRegistryDefinitionId: string
  credentialDefinitionId: string
  state: AnonCredsRevocationRegistryState
}

const anonCredsRevocationRegistryDefinitionPrivateRecordEncodingSchema = createRecordEncodingSchema({
  revocationRegistryDefinitionId: z.string().nullish(),
  credentialDefinitionId: z.string().nullish(),
  value: zTypedObject<Record<string, unknown>>().nullish(),
  state: z.string().nullish(),
})

export class AnonCredsRevocationRegistryDefinitionPrivateRecord extends BaseRecord<
  DefaultAnonCredsRevocationRegistryPrivateTags,
  TagsBase
> {
  public static get encodingSchema(): z.ZodType {
    return anonCredsRevocationRegistryDefinitionPrivateRecordEncodingSchema
  }

  public static readonly type = 'AnonCredsRevocationRegistryDefinitionPrivateRecord'
  public readonly type = AnonCredsRevocationRegistryDefinitionPrivateRecord.type

  public readonly revocationRegistryDefinitionId!: string
  public readonly credentialDefinitionId!: string
  public readonly value!: Record<string, unknown> // TODO: Define structure

  public state!: AnonCredsRevocationRegistryState

  public constructor(props: AnonCredsRevocationRegistryDefinitionPrivateRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.revocationRegistryDefinitionId = props.revocationRegistryDefinitionId
      this.credentialDefinitionId = props.credentialDefinitionId
      this.value = props.value
      this.state = props.state ?? AnonCredsRevocationRegistryState.Created
    }
  }

  public getTags() {
    return {
      ...this._tags,
      revocationRegistryDefinitionId: this.revocationRegistryDefinitionId,
      credentialDefinitionId: this.credentialDefinitionId,
      state: this.state,
    }
  }
}
