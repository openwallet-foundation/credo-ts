import type { AnonCredsCredentialDefinitionRecordMetadata } from './anonCredsCredentialDefinitionRecordMetadataTypes'
import type { AnonCredsCredentialDefinition } from '../models'
import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsCredentialDefinitionRecordProps {
  id?: string
  credentialDefinitionId: string
  credentialDefinition: AnonCredsCredentialDefinition
  methodName: string
}

export type DefaultAnonCredsCredentialDefinitionTags = {
  schemaId: string
  credentialDefinitionId: string
  issuerId: string
  tag: string
  methodName: string
}

export class AnonCredsCredentialDefinitionRecord extends BaseRecord<
  DefaultAnonCredsCredentialDefinitionTags,
  TagsBase,
  AnonCredsCredentialDefinitionRecordMetadata
> {
  public static readonly type = 'AnonCredsCredentialDefinitionRecord'
  public readonly type = AnonCredsCredentialDefinitionRecord.type

  public credentialDefinitionId!: string
  public credentialDefinition!: AnonCredsCredentialDefinition

  /**
   * AnonCreds method name. We don't use names explicitly from the registry (there's no identifier for a registry)
   * @see https://hyperledger.github.io/anoncreds-methods-registry/
   */
  public methodName!: string

  public constructor(props: AnonCredsCredentialDefinitionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialDefinitionId = props.credentialDefinitionId
      this.credentialDefinition = props.credentialDefinition
      this.methodName = props.methodName
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credentialDefinitionId,
      schemaId: this.credentialDefinition.schemaId,
      issuerId: this.credentialDefinition.issuerId,
      tag: this.credentialDefinition.tag,
      methodName: this.methodName,
    }
  }
}
