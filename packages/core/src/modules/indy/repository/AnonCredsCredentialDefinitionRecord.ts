import type { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { didFromCredentialDefinitionId } from '../../../utils/did'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
}

export type DefaultAnonCredsCredentialDefinitionTags = {
  credentialDefinitionId: string
  issuerDid?: string
  schemaId?: string
  tag?: string
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord<DefaultAnonCredsCredentialDefinitionTags> {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type
  public readonly credentialDefinition!: CredDef

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.credentialDefinition = props.credentialDefinition
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinition.id,
      issuerDid: didFromCredentialDefinitionId(this.credentialDefinition.id),
      schemaId: this.credentialDefinition.schemaId,
      tag: this.credentialDefinition.tag,
    }
  }
}
