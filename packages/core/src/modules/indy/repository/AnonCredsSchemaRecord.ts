import type { Schema } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { didFromSchemaId } from '../../../utils/did'

export interface AnonCredsSchemaRecordProps {
  schema: Schema
}

export type DefaultAnonCredsSchemaTags = {
  schemaId: string
  schemaIssuerDid: string
  schemaName: string
  schemaVersion: string
}

export class AnonCredsSchemaRecord extends BaseRecord<DefaultAnonCredsSchemaTags> {
  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type
  public readonly schema!: Schema

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.schema = props.schema
    }
  }

  public getTags() {
    return {
      ...this._tags,
      schemaId: this.schema.id,
      schemaIssuerDid: didFromSchemaId(this.schema.id),
      schemaName: this.schema.name,
      schemaVersion: this.schema.version,
    }
  }
}
