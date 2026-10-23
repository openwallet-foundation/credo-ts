import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, utils } from '@credo-ts/core'
import type { AnonCredsSchema } from '../models'
import type { AnonCredsSchemaRecordMetadata } from './anonCredsSchemaRecordMetadataTypes'

export interface AnonCredsSchemaRecordProps {
  id?: string
  schemaId: string
  schema: AnonCredsSchema
  methodName: string
  createdAt?: Date
}

export type DefaultAnonCredsSchemaTags = {
  schemaId: string
  issuerId: string
  schemaName: string
  schemaVersion: string
  methodName: string
}

export class AnonCredsSchemaRecord extends BaseRecord<
  DefaultAnonCredsSchemaTags,
  TagsBase,
  AnonCredsSchemaRecordMetadata
> {
  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type

  public schemaId!: string
  public schema!: AnonCredsSchema

  /**
   * AnonCreds method name. We don't use names explicitly from the registry (there's no identifier for a registry)
   * @see https://hyperledger.github.io/anoncreds-methods-registry/
   */
  public methodName!: string

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.schema = props.schema
      this.schemaId = props.schemaId
      this.methodName = props.methodName
    }
  }

  public getTags() {
    return {
      ...this._tags,
      schemaId: this.schemaId,
      issuerId: this.schema.issuerId,
      schemaName: this.schema.name,
      schemaVersion: this.schema.version,
      methodName: this.methodName,
    }
  }
}
