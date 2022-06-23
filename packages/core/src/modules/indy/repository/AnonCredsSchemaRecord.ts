import type { TagsBase } from '../../../storage/BaseRecord'
import type { GenericRecordTags } from '../../generic-records/repository/GenericRecord'

import { BaseRecord } from '../../../storage/BaseRecord'

export interface AnonCredsSchemaRecordProps {
  schemaId: string
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
}

export class AnonCredsSchemaRecord extends BaseRecord<GenericRecordTags> {
  public content!: Record<string, unknown>

  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type
  public readonly schemaId: string | undefined
  public readonly schemaIssuerDid: string | undefined
  public readonly schemaName: string | undefined
  public readonly schemaVersion: string | undefined

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.schemaId = props.schemaId
      this.schemaIssuerDid = props.schemaIssuerDid
      this.schemaName = props.schemaName
      this.schemaVersion = props.schemaVersion
    }
  }

  public getTags(): TagsBase {
    return {
      schemaId: this.schemaId,
      schemaIssuerId: this.schemaIssuerDid,
      schemaName: this.schemaName,
      schemaVersion: this.schemaVersion,
    }
  }
}
