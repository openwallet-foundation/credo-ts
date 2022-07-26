import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { Schema } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import {
  getDidFromSchemaOrCredentialDefinitionId,
  createQualifiedIdentifier,
  createUnqualifiedIdentifier,
} from '../../../utils/indyIdentifiers'

export interface AnonCredsSchemaRecordProps {
  schema: Schema
  didIndyNamespace: DidIndyNamespace
}

export type DefaultAnonCredsSchemaTags = {
  qualifiedIdentifier: string
  unqualifiedIdentifier: string
}

export class AnonCredsSchemaRecord extends BaseRecord<DefaultAnonCredsSchemaTags> {
  public static readonly type = 'AnonCredsSchemaRecord'
  public readonly type = AnonCredsSchemaRecord.type
  public readonly schema!: Schema
  private readonly identifier!: string

  public constructor(props: AnonCredsSchemaRecordProps) {
    super()

    if (props) {
      this.schema = props.schema
      this.identifier = createQualifiedIdentifier(
        props.didIndyNamespace,
        getDidFromSchemaOrCredentialDefinitionId(this.schema.id as string)
      )
    }
  }

  public get qualifiedIdentifier() {
    return this.identifier
  }

  public get unqualifiedIdentifier() {
    return createUnqualifiedIdentifier(this.identifier)
  }

  public getTags() {
    return {
      ...this._tags,
      qualifiedIdentifier: this.identifier,
      unqualifiedIdentifier: createUnqualifiedIdentifier(this.identifier),
    }
  }
}
