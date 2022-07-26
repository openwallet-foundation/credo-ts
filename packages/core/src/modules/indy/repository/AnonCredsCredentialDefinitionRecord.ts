import type { DidIndyNamespace } from '../../../utils/indyIdentifiers'
import type { CredDef } from 'indy-sdk'

import { BaseRecord } from '../../../storage/BaseRecord'
import {
  createQualifiedIdentifier,
  getDidFromSchemaOrCredentialDefinitionId,
  createUnqualifiedIdentifier,
} from '../../../utils/indyIdentifiers'

export interface AnonCredsCredentialDefinitionRecordProps {
  credentialDefinition: CredDef
  didIndyNamespace: DidIndyNamespace
}

export type DefaultAnonCredsCredentialDefinitionTags = {
  qualifiedIdentifier: string
  unqualifiedIdentifier: string
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord<DefaultAnonCredsCredentialDefinitionTags> {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type
  public readonly credentialDefinition!: CredDef
  private readonly identifier!: string

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.credentialDefinition = props.credentialDefinition
      this.identifier = createQualifiedIdentifier(
        props.didIndyNamespace,
        getDidFromSchemaOrCredentialDefinitionId(this.credentialDefinition.id)
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
