import type { AnonCredsCredential } from '@aries-framework/anoncreds'
import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsCredentialRecordProps {
  id?: string
  credential: AnonCredsCredential
  credentialId: string
  masterSecretId: string
}

export type DefaultAnonCredsCredentialTags = {
  credentialId: string
  masterSecretId: string
  credentialDefinitionId: string
}

export class AnonCredsCredentialRecord extends BaseRecord<DefaultAnonCredsCredentialTags, TagsBase> {
  public static readonly type = 'AnonCredsCredentialRecord'
  public readonly type = AnonCredsCredentialRecord.type

  public readonly credentialId!: string
  public readonly masterSecretId!: string
  public readonly credential!: AnonCredsCredential

  public constructor(props: AnonCredsCredentialRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.credentialId = props.credentialId
      this.credential = props.credential
      this.masterSecretId = props.masterSecretId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      credentialDefinitionId: this.credential.cred_def_id,
      credentialId: this.credentialId,
      masterSecretId: this.masterSecretId,
    }
  }
}
