import type { OpenId4VciCredentialSupportedWithId } from '../../shared'
import type { RecordTags, TagsBase } from '@aries-framework/core'
import type { CredentialSupported, MetadataDisplay } from '@sphereon/oid4vci-common'

import { BaseRecord, utils } from '@aries-framework/core'

export type OpenId4VcIssuerRecordTags = RecordTags<OpenId4VcIssuerRecord>

export type DefaultOpenId4VcIssuerRecordTags = {
  issuerId: string
}

export interface OpenId4VcIssuerRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  issuerId: string

  /**
   * The fingerprint (multibase encoded) of the public key used to sign access tokens for
   * this issuer.
   */
  accessTokenPublicKeyFingerprint: string

  credentialsSupported: OpenId4VciCredentialSupportedWithId[]
  display?: MetadataDisplay[]
}

export class OpenId4VcIssuerRecord extends BaseRecord<DefaultOpenId4VcIssuerRecordTags> {
  public static readonly type = 'OpenId4VcIssuerRecord'
  public readonly type = OpenId4VcIssuerRecord.type

  public issuerId!: string
  public accessTokenPublicKeyFingerprint!: string

  public credentialsSupported!: CredentialSupported[]
  public display?: MetadataDisplay[]

  public constructor(props: OpenId4VcIssuerRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.accessTokenPublicKeyFingerprint = props.accessTokenPublicKeyFingerprint
      this.credentialsSupported = props.credentialsSupported
      this.display = props.display
    }
  }

  public getTags() {
    return {
      ...this._tags,
      issuerId: this.issuerId,
    }
  }
}
