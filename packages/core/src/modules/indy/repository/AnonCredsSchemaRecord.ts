import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { Schema } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import { getQualifiedIdentifier } from '../../../utils/indyIdentifiers'
import { uuid } from '../../../utils/uuid'

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

    this.id = uuid()
    if (props) {
      this.schema = props.schema
      this._tags.id = getQualifiedIdentifier(props.didIndyNamespace, this.schema)
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
