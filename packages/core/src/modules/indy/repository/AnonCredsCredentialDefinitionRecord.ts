import type { TagsBase } from '../../../storage/BaseRecord'
import type { GenericRecordTags } from '../../generic-records/repository/GenericRecord'

import { BaseRecord } from '../../../storage/BaseRecord'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinitionId: string
  issuerDid?: string
  schemaId?: string
  tag?: string
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord<GenericRecordTags> {
  public content!: Record<string, unknown>

  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type
  public readonly credentialDefinitionId: string | undefined
  public readonly issuerDid: string | undefined
  public readonly schemaId: string | undefined
  public readonly tag: string | undefined

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.credentialDefinitionId = props.credentialDefinitionId
      this.issuerDid = props.issuerDid
      this.schemaId = props.schemaId
      this.tag = props.tag
    }
  }

  public getTags(): TagsBase {
    return {
      credentialDefinitionId: this.credentialDefinitionId,
      issuerDid: this.issuerDid,
      schemaId: this.schemaId,
      tag: this.tag,
    }
  }
}
