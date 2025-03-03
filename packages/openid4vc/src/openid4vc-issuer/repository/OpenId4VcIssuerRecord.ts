import type { JwaSignatureAlgorithm, RecordTags, TagsBase } from '@credo-ts/core'
import type {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
} from '../../shared'
import type { OpenId4VciBatchCredentialIssuanceOptions } from '../OpenId4VcIssuerServiceOptions'

import { BaseRecord, utils } from '@credo-ts/core'
import { credentialsSupportedToCredentialConfigurationsSupported } from '@openid4vc/openid4vci'
import { Transform, TransformationType } from 'class-transformer'

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

  display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats

  /**
   * Indicate support for batch issuane of credentials
   */
  batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions
}

/**
 * For OID4VC you need to expose metadata files. Each issuer needs to host this metadata. This is not the case for DIDComm where we can just have one /didcomm endpoint.
 * So we create a record per openid issuer/verifier that you want, and each tenant can create multiple issuers/verifiers which have different endpoints
 * and metadata files
 * */
export class OpenId4VcIssuerRecord extends BaseRecord<DefaultOpenId4VcIssuerRecordTags> {
  public static readonly type = 'OpenId4VcIssuerRecord'
  public readonly type = OpenId4VcIssuerRecord.type

  public issuerId!: string
  public accessTokenPublicKeyFingerprint!: string

  /**
   * Only here for class transformation. If credentialsSupported is set we transform
   * it to the new credentialConfigurationsSupported format
   */
  private set credentialsSupported(credentialsSupported: Array<unknown>) {
    if (this.credentialConfigurationsSupported) return

    this.credentialConfigurationsSupported =
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      credentialsSupportedToCredentialConfigurationsSupported(credentialsSupported as any) as any
  }

  public credentialConfigurationsSupported!: OpenId4VciCredentialConfigurationsSupportedWithFormats

  // Draft 11 to draft 13+ syntax
  @Transform(({ type, value }) => {
    if (type === TransformationType.PLAIN_TO_CLASS && Array.isArray(value)) {
      return value.map((display) => {
        if (display.logo?.uri) return display

        const { url, ...logoRest } = display.logo ?? {}
        return {
          ...display,
          logo: url
            ? {
                ...logoRest,
                uri: url,
              }
            : undefined,
        }
      })
    }

    return value
  })
  public display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  public authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]
  public dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]
  public batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions

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
      this.batchCredentialIssuance = props.batchCredentialIssuance
    }
  }

  public getTags() {
    return {
      ...this._tags,
      issuerId: this.issuerId,
    }
  }
}
