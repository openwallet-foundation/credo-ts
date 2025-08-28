import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, utils } from '@credo-ts/core'

export enum AnonCredsRevocationRegistryState {
  Created = 'created',
  Active = 'active',
  Full = 'full',
}

export interface AnonCredsRevocationRegistryDefinitionPrivateRecordProps {
  id?: string
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

export class AnonCredsRevocationRegistryDefinitionPrivateRecord extends BaseRecord<
  DefaultAnonCredsRevocationRegistryPrivateTags,
  TagsBase
> {
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
