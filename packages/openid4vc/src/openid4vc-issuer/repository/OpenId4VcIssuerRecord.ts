import { BaseRecord, CredoError, isJsonObject, Kms, type RecordTags, type TagsBase, utils } from '@credo-ts/core'
import { credentialsSupportedToCredentialConfigurationsSupported } from '@openid4vc/openid4vci'
import { Transform, TransformationType } from 'class-transformer'
import type {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
} from '../../shared'
import type { OpenId4VciBatchCredentialIssuanceOptions } from '../OpenId4VcIssuerServiceOptions'

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
   * The public jwk of the key used to sign access tokens for this issuer. Must include a `kid` parameter.
   */
  accessTokenPublicJwk: Kms.KmsJwkPublicAsymmetric

  /**
   * The DPoP signing algorithms supported by this issuer.
   * If not provided, dPoP is considered unsupported.
   */
  dpopSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]

  display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats

  /**
   * Indicate support for batch issuance of credentials
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

  /**
   * @deprecated accessTokenPublicJwk should be used
   * @todo remove in migration
   */
  public accessTokenPublicKeyFingerprint?: string
  public accessTokenPublicJwk?: Kms.KmsJwkPublicAsymmetric

  /**
   * Only here for class transformation. If credentialsSupported is set we transform
   * it to the new credentialConfigurationsSupported format
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: see above
  private set credentialsSupported(credentialsSupported: Array<unknown>) {
    if (this.credentialConfigurationsSupported) return

    this.credentialConfigurationsSupported =
      // biome-ignore lint/suspicious/noExplicitAny: no explanation
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

  // Adds the type field if missing (for older records)
  @Transform(({ type, value }) => {
    if (type === TransformationType.PLAIN_TO_CLASS && Array.isArray(value)) {
      return value.map((config) => {
        if (isJsonObject(config) && typeof config.type === 'undefined') {
          return {
            ...config,
            type: 'direct',
          }
        }

        return value
      })
    }

    return value
  })
  public authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  public dpopSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]
  public batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions

  public get directAuthorizationServerConfigs() {
    return this.authorizationServerConfigs?.filter((config) => config.type === 'direct')
  }

  public get chainedAuthorizationServerConfigs() {
    return this.authorizationServerConfigs?.filter((config) => config.type === 'chained')
  }

  public get resolvedAccessTokenPublicJwk() {
    if (this.accessTokenPublicJwk) {
      return Kms.PublicJwk.fromPublicJwk(this.accessTokenPublicJwk)
    }

    // From before we introduced key ids, uses legacy key id
    if (this.accessTokenPublicKeyFingerprint) {
      const publicJwk = Kms.PublicJwk.fromFingerprint(this.accessTokenPublicKeyFingerprint)
      publicJwk.keyId = publicJwk.legacyKeyId
      return publicJwk
    }

    throw new CredoError(
      'Neither accessTokenPublicJwk or accessTokenPublicKeyFingerprint defined. Unable to resolve access token public jwk.'
    )
  }

  public constructor(props: OpenId4VcIssuerRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.accessTokenPublicJwk = props.accessTokenPublicJwk
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
