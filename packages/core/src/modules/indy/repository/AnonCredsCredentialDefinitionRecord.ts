import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { isQualifiedIdentifier, getQualifiedIdentifier } from '../../../utils/indyIdentifiers'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
  didIndyNamespace: DidIndyNamespace
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type
  public readonly credentialDefinition!: CredDef

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.credentialDefinition = props.credentialDefinition
      this._tags.id = isQualifiedIdentifier(this._tags.id as string)
        ? (this._tags.id as string)
        : getQualifiedIdentifier(props.didIndyNamespace, this.credentialDefinition)
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
