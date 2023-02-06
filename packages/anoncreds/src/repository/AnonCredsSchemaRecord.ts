import type { AnonCredsSchemaRecordMetadata } from './anonCredsSchemaRecordMetadataTypes'
import type { AnonCredsSchema } from '../models'
import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsSchemaRecordProps {
  id?: string
  schemaId: string
  schema: AnonCredsSchema
}

export type DefaultAnonCredsSchemaTags = {
  schemaId: string
  issuerId: string
  schemaName: string
  schemaVersion: string
}

export class AnonCredsSchemaRecord extends BaseRecord<
  DefaultAnonCredsSchemaTags,
  TagsBase,
  AnonCredsSchemaRecordMetadata
> {
  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type

  public readonly schemaId!: string
  public readonly schema!: AnonCredsSchema

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.schema = props.schema
      this.schemaId = props.schemaId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      schemaId: this.schemaId,
      issuerId: this.schema.issuerId,
      schemaName: this.schema.name,
      schemaVersion: this.schema.version,
    }
  }
}
