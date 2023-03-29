import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsRevocationRegistryDefinitionPrivateRecordProps {
  id?: string
  revocationRegistryDefinitionId: string
  value: Record<string, unknown>
  index?: number
}

export type DefaultAnonCredsRevocationRegistryPrivateTags = {
  revocationRegistryDefinitionId: string
}

export class AnonCredsRevocationRegistryDefinitionPrivateRecord extends BaseRecord<
  DefaultAnonCredsRevocationRegistryPrivateTags,
  TagsBase
> {
  public static readonly type = 'AnonCredsRevocationRegistryDefinitionPrivateRecord'
  public readonly type = AnonCredsRevocationRegistryDefinitionPrivateRecord.type

  public readonly revocationRegistryDefinitionId!: string
  public readonly value!: Record<string, unknown> // TODO: Define structure

  public currentIndex!: number
  public constructor(props: AnonCredsRevocationRegistryDefinitionPrivateRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.revocationRegistryDefinitionId = props.revocationRegistryDefinitionId
      this.value = props.value
      this.currentIndex = props.index ?? 0
    }
  }

  public getTags() {
    return {
      ...this._tags,
      revocationRegistryDefinitionId: this.revocationRegistryDefinitionId,
    }
  }
}
