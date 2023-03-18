import type { AnonCredsCredential } from '../models'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsCredentialRecordProps {
  id?: string
  credential: AnonCredsCredential
  credentialId: string
  credentialRevocationId?: string
  linkSecretId: string
  schemaName: string
  schemaVersion: string
  schemaIssuerId: string
  issuerId: string
  methodName: string
}

export type DefaultAnonCredsCredentialTags = {
  credentialId: string
  linkSecretId: string
  credentialDefinitionId: string
  credentialRevocationId?: string
  revocationRegistryId?: string
  schemaId: string
  attributes: string[]
  methodName: string
}

export type CustomAnonCredsCredentialTags = {
  schemaName: string
  schemaVersion: string
  schemaIssuerId: string
  issuerId: string
}

export class AnonCredsCredentialRecord extends BaseRecord<
  DefaultAnonCredsCredentialTags,
  CustomAnonCredsCredentialTags
> {
  public static readonly type = 'AnonCredsCredentialRecord'
  public readonly type = AnonCredsCredentialRecord.type

  public readonly credentialId!: string
  public readonly credentialRevocationId?: string
  public readonly linkSecretId!: string
  public readonly credential!: AnonCredsCredential

  /**
   * AnonCreds method name. We don't use names explicitly from the registry (there's no identifier for a registry)
   * @see https://hyperledger.github.io/anoncreds-methods-registry/
   */
  public readonly methodName!: string

  public constructor(props: AnonCredsCredentialRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialId = props.credentialId
      this.credential = props.credential
      this.credentialRevocationId = props.credentialRevocationId
      this.linkSecretId = props.linkSecretId
      this.methodName = props.methodName
      this.setTags({
        issuerId: props.issuerId,
        schemaIssuerId: props.schemaIssuerId,
        schemaName: props.schemaName,
        schemaVersion: props.schemaVersion,
      })
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credential.cred_def_id,
      schemaId: this.credential.schema_id,
      credentialId: this.credentialId,
      credentialRevocationId: this.credentialRevocationId,
      revocationRegistryId: this.credential.rev_reg_id,
      linkSecretId: this.linkSecretId,
      attributes: Object.keys(this.credential.values),
      methodName: this.methodName,
    }
  }
}
