import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, createRecordEncodingSchema, utils, zTypedObject } from '@credo-ts/core'
import { z } from 'zod'
import type { AnonCredsRevocationRegistryDefinition } from '../models'
import type { AnonCredsRevocationRegistryDefinitionRecordMetadata } from './anonCredsRevocationRegistryDefinitionRecordMetadataTypes'

export interface AnonCredsRevocationRegistryDefinitionRecordProps {
  id?: string
  revocationRegistryDefinitionId: string
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  createdAt?: Date
}

export type DefaultAnonCredsRevocationRegistryDefinitionTags = {
  revocationRegistryDefinitionId: string
  credentialDefinitionId: string
}

const anonCredsRevocationRegistryDefinitionRecordEncodingSchema = createRecordEncodingSchema({
  revocationRegistryDefinitionId: z.string().optional(),
  revocationRegistryDefinition: zTypedObject<AnonCredsRevocationRegistryDefinition>().optional(),
})

export class AnonCredsRevocationRegistryDefinitionRecord extends BaseRecord<
  DefaultAnonCredsRevocationRegistryDefinitionTags,
  TagsBase,
  AnonCredsRevocationRegistryDefinitionRecordMetadata
> {
  public static get encodingSchema(): z.ZodType {
    return anonCredsRevocationRegistryDefinitionRecordEncodingSchema
  }

  public static readonly type = 'AnonCredsRevocationRegistryDefinitionRecord'
  public readonly type = AnonCredsRevocationRegistryDefinitionRecord.type

  public readonly revocationRegistryDefinitionId!: string
  public readonly revocationRegistryDefinition!: AnonCredsRevocationRegistryDefinition

  public constructor(props: AnonCredsRevocationRegistryDefinitionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.revocationRegistryDefinitionId = props.revocationRegistryDefinitionId
      this.revocationRegistryDefinition = props.revocationRegistryDefinition
      this.createdAt = props.createdAt ?? new Date()
    }
  }

  public getTags() {
    return {
      ...this._tags,
      revocationRegistryDefinitionId: this.revocationRegistryDefinitionId,
      credentialDefinitionId: this.revocationRegistryDefinition.credDefId,
    }
  }
}
