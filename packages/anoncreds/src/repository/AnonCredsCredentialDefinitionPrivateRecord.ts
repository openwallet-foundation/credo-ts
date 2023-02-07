import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsCredentialDefinitionPrivateRecordProps {
  id?: string
  credentialDefinitionId: string
  value: Record<string, unknown>
}

export type DefaultAnonCredsCredentialDefinitionPrivateTags = {
  credentialDefinitionId: string
}

export class AnonCredsCredentialDefinitionPrivateRecord extends BaseRecord<
  DefaultAnonCredsCredentialDefinitionPrivateTags,
  TagsBase
> {
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
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinitionId,
    }
  }
}
