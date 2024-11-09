import type {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
} from '../../shared'
import type { JwaSignatureAlgorithm, RecordTags, TagsBase } from '@credo-ts/core'

import { BaseRecord, utils } from '@credo-ts/core'

export type OpenId4VcIssuerRecordTags = RecordTags<OpenId4VcIssuerRecord>

export type DefaultOpenId4VcIssuerRecordTags = {
  issuerId: string
}

export type OpenId4VcIssuerRecordProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  issuerId: string

  /**
   * The fingerprint (multibase encoded) of the public key used to sign access tokens for
   * this issuer.
   */
  accessTokenPublicKeyFingerprint: string

  /**
   * The DPoP signing algorithms supported by this issuer.
   * If not provided, dPoP is considered unsupported.
   */
  dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]

  // FIXME: migrate to v13 structure (uri vs url)
  display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  // TODO: with formats or without formats?
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats
}

/**
 * For OID4VC you need to expos metadata files. Each issuer needs to host this metadata. This is not the case for DIDComm where we can just have one /didcomm endpoint.
 * So we create a record per openid issuer/verifier that you want, and each tenant can create multiple issuers/verifiers which have different endpoints
 * and metadata files
 * */
export class OpenId4VcIssuerRecord extends BaseRecord<DefaultOpenId4VcIssuerRecordTags> {
  public static readonly type = 'OpenId4VcIssuerRecord'
  public readonly type = OpenId4VcIssuerRecord.type

  public issuerId!: string
  public accessTokenPublicKeyFingerprint!: string

  // FIXME: migration of supported to configurations
  public credentialsSupported?: Array<unknown>
  public credentialConfigurationsSupported?: OpenId4VciCredentialConfigurationsSupportedWithFormats
  public display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  public authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]
  public dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]

  public constructor(props: OpenId4VcIssuerRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.accessTokenPublicKeyFingerprint = props.accessTokenPublicKeyFingerprint
      this.credentialConfigurationsSupported = props.credentialConfigurationsSupported
      this.dpopSigningAlgValuesSupported = props.dpopSigningAlgValuesSupported
      this.display = props.display
      this.authorizationServerConfigs = props.authorizationServerConfigs
    }
  }

  public getTags() {
    return {
      ...this._tags,
      issuerId: this.issuerId,
    }
  }
}
