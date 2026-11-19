import {
  BaseRecord,
  CredoError,
  createRecordEncodingSchema,
  isJsonObject,
  Kms,
  type RecordTags,
  type TagsBase,
  utils,
  zTypedObject,
  zWithUpgrade,
} from '@credo-ts/core'
import { credentialsSupportedToCredentialConfigurationsSupported } from '@openid4vc/openid4vci'
import { z } from 'zod'
import type {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
  OpenId4VciIssuerInfo,
  OpenId4VcJwtIssuerEncoded,
} from '../../shared'
import { getThumbprintKid } from '../../shared/utils'
import type {
  OpenId4VciBatchCredentialIssuanceOptions,
  OpenId4VciCredentialResponseEncryptionOptions,
} from '../OpenId4VcIssuerServiceOptions'

export type OpenId4VcIssuerRecordTags = RecordTags<OpenId4VcIssuerRecord>

export type DefaultOpenId4VcIssuerRecordTags = {
  issuerId: string
}

export type OpenId4VcIssuerRecordSignedMetadata = {
  signer: OpenId4VcJwtIssuerEncoded

  /**
   * The credential issuer metadata as a signed JWT
   */
  jwt: string
}

/**
 * A KMS key and its public jwk, as the issuer record stores it.
 */
export type OpenId4VcIssuerRecordKey = Kms.KmsKeyReference & {
  /**
   * The public jwk of the key, without `kid`.
   */
  publicJwk: Kms.KmsJwkPublicAsymmetric
}

export function toOpenId4VcIssuerRecordKey(publicJwk: Kms.PublicJwk): OpenId4VcIssuerRecordKey {
  return {
    publicJwk: publicJwk.toJson({ includeKid: false }) as Kms.KmsJwkPublicAsymmetric,
    keyId: publicJwk.keyId,
    kmsBackend: publicJwk.kmsBackend,
  }
}

export type OpenId4VcIssuerRecordCredentialRequestEncryption = {
  required?: boolean

  /**
   * The keys to advertise.
   */
  keys: [OpenId4VcIssuerRecordKey, ...OpenId4VcIssuerRecordKey[]]

  /**
   * Keys that are no longer advertised but still decrypt credential requests.
   */
  previousKeys?: OpenId4VcIssuerRecordKey[]
}

export type OpenId4VcIssuerRecordProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  issuerId: string

  /**
   * The key used to sign access tokens for this issuer.
   */
  accessTokenKey: OpenId4VcIssuerRecordKey

  /**
   * Access token signing keys that were rotated out. They still verify tokens signed before the rotation.
   */
  previousAccessTokenKeys?: OpenId4VcIssuerRecordKey[]

  /**
   * The DPoP signing algorithms supported by this issuer.
   * If not provided, `dpopSigningAlgValuesSupported` from the issuer module config is used, or else all
   * signature algorithms supported by the agent's KMS.
   */
  dpopSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]

  /**
   * The signing algorithms supported by this issuer for the Client Attestation JWT and the Client
   * Attestation PoP JWT (draft 09 of OAuth 2.0 Attestation-Based Client Authentication). Advertised as
   * `client_attestation_signing_alg_values_supported` / `client_attestation_pop_signing_alg_values_supported`.
   */
  clientAttestationSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]
  clientAttestationPopSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]

  display?: OpenId4VciCredentialIssuerMetadataDisplay[]

  // Issuer attestations published as `issuer_info` in the credential issuer metadata.
  issuerInfo?: OpenId4VciIssuerInfo
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats

  /**
   * Indicate support for batch issuance of credentials
   */
  batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions

  credentialResponseEncryption?: OpenId4VciCredentialResponseEncryptionOptions
  credentialRequestEncryption?: OpenId4VcIssuerRecordCredentialRequestEncryption

  /**
   * When signed metadata is supported, this stores the
   * signed jwt and signer information to update the JWT in the future.
   */
  signedMetadata?: OpenId4VcIssuerRecordSignedMetadata
}

const openId4VcIssuerRecordEncodingSchema = createRecordEncodingSchema(
  {
    issuerId: z.string().nullish(),
    accessTokenPublicKeyFingerprint: z.string().nullish(),
    accessTokenPublicJwk: zTypedObject<Kms.KmsJwkPublicAsymmetric>().nullish(),
    accessTokenKey: zTypedObject<OpenId4VcIssuerRecordKey>().nullish(),
    accessTokenSignerKmsBackend: z.string().nullish(),
    previousAccessTokenKeys: z.array(zTypedObject<OpenId4VcIssuerRecordKey>()).nullish(),
    credentialConfigurationsSupported: zTypedObject<OpenId4VciCredentialConfigurationsSupportedWithFormats>().nullish(),
    // Draft 11 to draft 13+ syntax
    display: zWithUpgrade(z.array(zTypedObject<OpenId4VciCredentialIssuerMetadataDisplay>()), (value) => {
      if (!Array.isArray(value)) return value

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
    }).nullish(),
    issuerInfo: z.array(zTypedObject<OpenId4VciIssuerInfo[number]>()).nullish(),
    // Adds the type field if missing (for older records)
    authorizationServerConfigs: zWithUpgrade(z.array(zTypedObject<OpenId4VciAuthorizationServerConfig>()), (value) => {
      if (!Array.isArray(value)) return value

      return value.map((config) => {
        if (isJsonObject(config) && typeof config.type === 'undefined') {
          return {
            ...config,
            type: 'direct',
          }
        }

        return config
      })
    }).nullish(),
    dpopSigningAlgValuesSupported: z.array(z.string()).nullish(),
    clientAttestationSigningAlgValuesSupported: z.array(z.string()).nullish(),
    clientAttestationPopSigningAlgValuesSupported: z.array(z.string()).nullish(),
    batchCredentialIssuance: zTypedObject<OpenId4VciBatchCredentialIssuanceOptions>().nullish(),
    credentialResponseEncryption: zTypedObject<OpenId4VciCredentialResponseEncryptionOptions>().nullish(),
    credentialRequestEncryption: zTypedObject<OpenId4VcIssuerRecordCredentialRequestEncryption>().nullish(),
    signedMetadata: zTypedObject<OpenId4VcIssuerRecordSignedMetadata>().nullish(),
  },
  {
    // Records stored before draft 13 have credentialsSupported instead of credentialConfigurationsSupported
    upgrade: ({ credentialsSupported, ...encoded }) => {
      if (credentialsSupported === undefined || encoded.credentialConfigurationsSupported !== undefined) return encoded

      return {
        ...encoded,
        credentialConfigurationsSupported: credentialsSupportedToCredentialConfigurationsSupported(
          // biome-ignore lint/suspicious/noExplicitAny: no explanation
          credentialsSupported as any
        ),
      }
    },
  }
)

/**
 * For OID4VC you need to expose metadata files. Each issuer needs to host this metadata. This is not the case for DIDComm where we can just have one /didcomm endpoint.
 * So we create a record per openid issuer/verifier that you want, and each tenant can create multiple issuers/verifiers which have different endpoints
 * and metadata files
 * */
export class OpenId4VcIssuerRecord extends BaseRecord<DefaultOpenId4VcIssuerRecordTags> {
  public static get encodingSchema(): z.ZodType {
    return openId4VcIssuerRecordEncodingSchema
  }

  public static readonly type = 'OpenId4VcIssuerRecord'
  public readonly type = OpenId4VcIssuerRecord.type

  public issuerId!: string

  /**
   * @deprecated accessTokenPublicJwk should be used
   * @todo remove in migration
   */
  public accessTokenPublicKeyFingerprint?: string

  /**
   * @deprecated accessTokenKey should be used. Its `kid` is the KMS key id.
   */
  public accessTokenPublicJwk?: Kms.KmsJwkPublicAsymmetric

  /**
   * @deprecated accessTokenKey should be used
   */
  public accessTokenSignerKmsBackend?: string

  public accessTokenKey?: OpenId4VcIssuerRecordKey
  public previousAccessTokenKeys?: OpenId4VcIssuerRecordKey[]

  public credentialConfigurationsSupported!: OpenId4VciCredentialConfigurationsSupportedWithFormats

  public display?: OpenId4VciCredentialIssuerMetadataDisplay[]

  public issuerInfo?: OpenId4VciIssuerInfo

  public authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]

  public dpopSigningAlgValuesSupported?: [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]
  public clientAttestationSigningAlgValuesSupported?: [
    Kms.KnownJwaSignatureAlgorithm,
    ...Kms.KnownJwaSignatureAlgorithm[],
  ]
  public clientAttestationPopSigningAlgValuesSupported?: [
    Kms.KnownJwaSignatureAlgorithm,
    ...Kms.KnownJwaSignatureAlgorithm[],
  ]
  public batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions
  public credentialResponseEncryption?: OpenId4VciCredentialResponseEncryptionOptions
  public credentialRequestEncryption?: OpenId4VcIssuerRecordCredentialRequestEncryption

  public signedMetadata?: OpenId4VcIssuerRecordSignedMetadata

  public get directAuthorizationServerConfigs() {
    return this.authorizationServerConfigs?.filter((config) => config.type === 'direct')
  }

  public get chainedAuthorizationServerConfigs() {
    return this.authorizationServerConfigs?.filter((config) => config.type === 'chained')
  }

  public get resolvedAccessTokenPublicJwk() {
    if (this.accessTokenKey) {
      const { publicJwk, keyId, kmsBackend } = this.accessTokenKey
      return Kms.PublicJwk.fromKmsKey({ publicJwk, keyId, backend: kmsBackend })
    }

    if (this.accessTokenPublicJwk) {
      const publicJwk = Kms.PublicJwk.fromPublicJwk(this.accessTokenPublicJwk)
      publicJwk.kmsBackend = this.accessTokenSignerKmsBackend
      return publicJwk
    }

    // From before we introduced key ids, uses legacy key id
    if (this.accessTokenPublicKeyFingerprint) {
      const publicJwk = Kms.PublicJwk.fromFingerprint(this.accessTokenPublicKeyFingerprint)
      publicJwk.keyId = publicJwk.legacyKeyId
      return publicJwk
    }

    throw new CredoError(
      'Neither accessTokenKey, accessTokenPublicJwk or accessTokenPublicKeyFingerprint defined. Unable to resolve access token public jwk.'
    )
  }

  /**
   * The access token signing keys that were rotated out, in the order of `previousAccessTokenKeys`.
   */
  public get resolvedPreviousAccessTokenPublicJwks() {
    return (this.previousAccessTokenKeys ?? []).map(({ publicJwk, keyId, kmsBackend }) =>
      Kms.PublicJwk.fromKmsKey({ publicJwk, keyId, backend: kmsBackend })
    )
  }

  /**
   * The current and previous access token signing keys, current first.
   */
  public get resolvedAccessTokenPublicJwks() {
    return [this.resolvedAccessTokenPublicJwk, ...this.resolvedPreviousAccessTokenPublicJwks]
  }

  /**
   * The current or previous access token signing key for the `kid` of a token header. That's the JWK thumbprint, or the
   * KMS key id for tokens signed before the thumbprint was used.
   */
  public getAccessTokenPublicJwk(kid: string | undefined) {
    const key = this.resolvedAccessTokenPublicJwks.find(
      (key) => kid !== undefined && (getThumbprintKid(key) === kid || (key.hasKeyId && key.keyId === kid))
    )
    if (!key) throw new CredoError(`No access token signing key found for kid '${kid}'.`)

    return key
  }

  public constructor(props: OpenId4VcIssuerRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.accessTokenKey = props.accessTokenKey
      this.previousAccessTokenKeys = props.previousAccessTokenKeys
      this.credentialConfigurationsSupported = props.credentialConfigurationsSupported
      this.dpopSigningAlgValuesSupported = props.dpopSigningAlgValuesSupported
      this.clientAttestationSigningAlgValuesSupported = props.clientAttestationSigningAlgValuesSupported
      this.clientAttestationPopSigningAlgValuesSupported = props.clientAttestationPopSigningAlgValuesSupported
      this.display = props.display
      this.issuerInfo = props.issuerInfo
      this.authorizationServerConfigs = props.authorizationServerConfigs
      this.batchCredentialIssuance = props.batchCredentialIssuance
      this.credentialResponseEncryption = props.credentialResponseEncryption
      this.credentialRequestEncryption = props.credentialRequestEncryption
      this.signedMetadata = props.signedMetadata
    }
  }

  public getTags() {
    return {
      ...this._tags,
      issuerId: this.issuerId,
    }
  }
}
