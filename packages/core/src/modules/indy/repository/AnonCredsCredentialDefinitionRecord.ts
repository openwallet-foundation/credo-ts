import type { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type

  public readonly credentialDefinition!: CredDef

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.id = uuid()
      this.credentialDefinition = props.credentialDefinition
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinition.id,
    }
  }
}
