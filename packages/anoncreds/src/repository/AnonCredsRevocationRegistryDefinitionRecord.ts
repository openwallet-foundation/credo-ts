import type { AnonCredsRevocationRegistryDefinition } from '../models'
import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsRevocationRegistryDefinitionRecordProps {
  id?: string
  revocationRegistryDefinitionId: string
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  tailsHash: string
}

export type DefaultAnonCredsRevocationRegistryDefinitionTags = {
  revocationRegistryDefinitionId: string
}

export class AnonCredsRevocationRegistryDefinitionRecord extends BaseRecord<
  DefaultAnonCredsRevocationRegistryDefinitionTags,
  TagsBase
> {
  public static readonly type = 'AnonCredsRevocationRegistryDefinitionRecord'
  public readonly type = AnonCredsRevocationRegistryDefinitionRecord.type

  public readonly revocationRegistryDefinitionId!: string
  public readonly revocationRegistryDefinition!: AnonCredsRevocationRegistryDefinition
  public readonly tailsHash!: string

  public constructor(props: AnonCredsRevocationRegistryDefinitionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.revocationRegistryDefinitionId = props.revocationRegistryDefinitionId
      this.revocationRegistryDefinition = props.revocationRegistryDefinition
      this.tailsHash = props.tailsHash
    }
  }

  public getTags() {
    return {
      ...this._tags,
      revocationRegistryDefinitionId: this.revocationRegistryDefinitionId,
    }
  }
}
