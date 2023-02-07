import type { AnonCredsCredential } from '@aries-framework/anoncreds'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsCredentialRecordProps {
  id?: string
  credential: AnonCredsCredential
  credentialId: string
  linkSecretId: string
  schemaName: string
  schemaVersion: string
  schemaIssuerDid: string
  issuerDid: string
}

export type DefaultAnonCredsCredentialTags = {
  credentialId: string
  linkSecretId: string
  credentialDefinitionId: string
  schemaId: string
  attributes: string[]
}

export type CustomAnonCredsCredentialTags = {
  schemaName: string
  schemaVersion: string
  schemaIssuerDid: string
  issuerDid: string
}

export class AnonCredsCredentialRecord extends BaseRecord<
  DefaultAnonCredsCredentialTags,
  CustomAnonCredsCredentialTags
> {
  public static readonly type = 'AnonCredsCredentialRecord'
  public readonly type = AnonCredsCredentialRecord.type

  public readonly credentialId!: string
  public readonly linkSecretId!: string
  public readonly credential!: AnonCredsCredential

  public constructor(props: AnonCredsCredentialRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialId = props.credentialId
      this.credential = props.credential
      this.linkSecretId = props.linkSecretId
      this.setTags({
        issuerDid: props.issuerDid,
        schemaIssuerDid: props.schemaIssuerDid,
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
      linkSecretId: this.linkSecretId,
      attributes: Object.keys(this.credential.values),
    }
  }
}
