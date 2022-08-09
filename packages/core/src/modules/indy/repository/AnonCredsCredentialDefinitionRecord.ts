import { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

import { CredentialDefinitionTransformer } from './anonCredsTransformers'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type

  @CredentialDefinitionTransformer()
  public readonly credentialDefinition!: CredDef

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    this.id = uuid()
    if (props) {
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
