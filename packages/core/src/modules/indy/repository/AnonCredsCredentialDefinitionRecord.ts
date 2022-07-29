import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { getQualifiedIdentifier } from '../../../utils/indyIdentifiers'
import { uuid } from '../../../utils/uuid'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
  didIndyNamespace: DidIndyNamespace
  schemaSeqNo: number
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type
  public readonly credentialDefinition!: CredDef
  public readonly schemaSeqNo!: number

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    this.id = uuid()
    if (props) {
      this.credentialDefinition = props.credentialDefinition
      this.schemaSeqNo = props.schemaSeqNo
      this._tags.id = getQualifiedIdentifier(props.didIndyNamespace, {
        ...this.credentialDefinition,
        schemaSeqNo: props.schemaSeqNo,
      })
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
