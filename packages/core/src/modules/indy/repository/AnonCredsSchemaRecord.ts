import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { Schema } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { isQualifiedIdentifier, getQualifiedIdentifier } from '../../../utils/indyIdentifiers'

export interface AnonCredsSchemaRecordProps {
  schema: Schema
  didIndyNamespace: DidIndyNamespace
}

export class AnonCredsSchemaRecord extends BaseRecord {
  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type
  public readonly schema!: Schema

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.schema = props.schema
      this._tags.id = isQualifiedIdentifier(this._tags.id as string)
        ? this._tags.id
        : getQualifiedIdentifier(props.didIndyNamespace, this.schema)
    }
  }

  public getTags() {
    // this._tags.id = isQualifiedIdentifier(this._tags.id as string) ? this._tags.id : this.identifier
    return {
      ...this._tags,
    }
  }
}
