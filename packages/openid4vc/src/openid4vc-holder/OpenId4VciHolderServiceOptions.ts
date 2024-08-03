import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VciCredentialSupportedWithId,
  OpenId4VciIssuerMetadata,
  OpenId4VciCredentialOfferPayload,
  OpenId4VciCredentialConfigurationsSupported,
} from '../shared'
import type { JwaSignatureAlgorithm, KeyType } from '@credo-ts/core'
import type { VerifiableCredential } from '@credo-ts/core/src/modules/dif-presentation-exchange/models/index'
import type {
  AccessTokenResponse,
  CredentialOfferRequestWithBaseUrl,
  EndpointMetadataResult,
  OpenId4VCIVersion,
} from '@sphereon/oid4vci-common'

import { OpenId4VciCredentialFormatProfile } from '../shared/models/OpenId4VciCredentialFormatProfile'

export type OpenId4VciSupportedCredentialFormats =
  | OpenId4VciCredentialFormatProfile.JwtVcJson
  | OpenId4VciCredentialFormatProfile.JwtVcJsonLd
  | OpenId4VciCredentialFormatProfile.SdJwtVc
  | OpenId4VciCredentialFormatProfile.LdpVc

export const openId4VciSupportedCredentialFormats: OpenId4VciSupportedCredentialFormats[] = [
  OpenId4VciCredentialFormatProfile.JwtVcJson,
  OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  OpenId4VciCredentialFormatProfile.SdJwtVc,
  OpenId4VciCredentialFormatProfile.LdpVc,
]

export interface OpenId4VciNotificationMetadata {
  notificationId: string
  notificationEndpoint: string
}

/**
 * 'credential_accepted' The Credential was successfully stored in the Wallet.
 * 'credential_deleted' when the unsuccessful Credential issuance was caused by a user action.
 * 'credential_failure' otherwise.
 */
export type OpenId4VciNotificationEvent = 'credential_accepted' | 'credential_failure' | 'credential_deleted'

export type OpenId4VciTokenResponse = Pick<AccessTokenResponse, 'access_token' | 'c_nonce'>

export type OpenId4VciRequestTokenResponse = { accessToken: string; cNonce?: string }

export interface OpenId4VciCredentialResponse {
  credential: VerifiableCredential
  notificationMetadata?: OpenId4VciNotificationMetadata
}

export interface OpenId4VciResolvedCredentialOffer {
  metadata: Omit<EndpointMetadataResult, 'credentialIssuerMetadata'> & {
    credentialIssuerMetadata: OpenId4VciIssuerMetadata
  }
  credentialOfferRequestWithBaseUrl: CredentialOfferRequestWithBaseUrl
  credentialOfferPayload: OpenId4VciCredentialOfferPayload
  offeredCredentials: OpenId4VciCredentialSupportedWithId[]
  offeredCredentialConfigurations: OpenId4VciCredentialConfigurationsSupported
  version: OpenId4VCIVersion
}

export interface OpenId4VciResolvedAuthorizationRequest extends OpenId4VciAuthCodeFlowOptions {
  codeVerifier: string
  authorizationRequestUri: string
}

export interface OpenId4VciResolvedAuthorizationRequestWithCode extends OpenId4VciResolvedAuthorizationRequest {
  code: string
}

export interface OpenId4VciSendNotificationOptions {
  /**
   * The notification metadata received from @see requestCredential
   */
  notificationMetadata: OpenId4VciNotificationMetadata

  /**
   * The access token obtained through @see requestToken
   */
  accessToken: string

  /**
   * The notification event
   *
   * 'credential_accepted' The Credential was successfully stored in the Wallet.
   * 'credential_deleted' when the unsuccessful Credential issuance was caused by a user action.
   * 'credential_failure' otherwise.
   */
  notificationEvent: OpenId4VciNotificationEvent
}

interface OpenId4VcTokenRequestBaseOptions {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  txCode?: string
}

export interface OpenId4VcAuthorizationCodeTokenRequestOptions extends OpenId4VcTokenRequestBaseOptions {
  resolvedAuthorizationRequest: OpenId4VciResolvedAuthorizationRequest
  code: string
}

export interface OpenId4VciPreAuthorizedTokenRequestOptions extends OpenId4VcTokenRequestBaseOptions {
  resolvedAuthorizationRequest?: never
  code?: never
}

export type OpenId4VciTokenRequestOptions =
  | OpenId4VciPreAuthorizedTokenRequestOptions
  | OpenId4VcAuthorizationCodeTokenRequestOptions

export interface OpenId4VciCredentialRequestOptions extends Omit<OpenId4VciAcceptCredentialOfferOptions, 'userPin'> {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  accessToken: string
  cNonce?: string

  /**
   * The client id used for authorization. Only required if authorization_code flow was used.
   */
  clientId?: string
}

/**
 * Options that are used to accept a credential offer for both the pre-authorized code flow and authorization code flow.
 * NOTE: Merge with @see OpenId4VciCredentialRequestOptions for 0.6
 */
export interface OpenId4VciAcceptCredentialOfferOptions {
  /**
   * String value containing a user PIN. This value MUST be present if user_pin_required was set to true in the Credential Offer.
   * This parameter MUST only be used, if the grant_type is urn:ietf:params:oauth:grant-type:pre-authorized_code.
   */
  userPin?: string

  /**
   * This is the list of credentials that will be requested from the issuer.
   * Should be a list of ids of the credentials that are included in the credential offer.
   * If not provided all offered credentials will be requested.
   */
  credentialsToRequest?: string[]

  verifyCredentialStatus?: boolean

  /**
   * A list of allowed proof of possession signature algorithms in order of preference.
   *
   * Note that the signature algorithms must be supported by the wallet implementation.
   * Signature algorithms that are not supported by the wallet will be ignored.
   *
   * The proof of possession (pop) signature algorithm is used in the credential request
   * to bind the credential to a did. In most cases the JWA signature algorithm
   * that is used in the pop will determine the cryptographic suite that is used
   * for signing the credential, but this not a requirement for the spec. E.g. if the
   * pop uses EdDsa, the credential will most commonly also use EdDsa, or Ed25519Signature2018/2020.
   */
  allowedProofOfPossessionSignatureAlgorithms?: JwaSignatureAlgorithm[]

  /**
   * A function that should resolve key material for binding the to-be-issued credential
   * to the holder based on the options passed. This key material will be used for signing
   * the proof of possession included in the credential request.
   *
   * This method will be called once for each of the credentials that are included
   * in the credential offer.
   *
   * Based on the credential format, JWA signature algorithm, verification method types
   * and binding methods (did methods, jwk), the resolver must return an object
   * conformant to the `CredentialHolderBinding` interface, which will be used
   * for the proof of possession signature.
   */
  credentialBindingResolver: OpenId4VciCredentialBindingResolver
}

/**
 * Options that are used for the authorization code flow.
 * Extends the pre-authorized code flow options.
 */
export interface OpenId4VciAuthCodeFlowOptions {
  clientId: string
  redirectUri: string
  scope?: string[]
}

export interface OpenId4VciCredentialBindingOptions {
  /**
   * The credential format that will be requested from the issuer.
   * E.g. `jwt_vc` or `ldp_vc`.
   */
  credentialFormat: OpenId4VciSupportedCredentialFormats

  /**
   * The JWA Signature Algorithm that will be used in the proof of possession.
   * This is based on the `allowedProofOfPossessionSignatureAlgorithms` passed
   * to the request credential method, and the supported signature algorithms.
   */
  signatureAlgorithm: JwaSignatureAlgorithm

  /**
   * This is a list of verification methods types that are supported
   * for creating the proof of possession signature. The returned
   * verification method type must be of one of these types.
   */
  supportedVerificationMethods: string[]

  /**
   * The key type that will be used to create the proof of possession signature.
   * This is related to the verification method and the signature algorithm, and
   * is added for convenience.
   */
  keyType: KeyType

  /**
   * The credential type that will be requested from the issuer. This is
   * based on the credential types that are included the credential offer.
   *
   * If the offered credential is an inline credential offer, the value
   * will be `undefined`.
   */
  supportedCredentialId?: string

  /**
   * Whether the issuer supports the `did` cryptographic binding method,
   * indicating they support all did methods. In most cases, they do not
   * support all did methods, and it means we have to make an assumption
   * about the did methods they support.
   *
   * If this value is `false`, the `supportedDidMethods` property will
   * contain a list of supported did methods.
   */
  supportsAllDidMethods: boolean

  /**
   * A list of supported did methods. This is only used if the `supportsAllDidMethods`
   * property is `false`. When this array is populated, the returned verification method
   * MUST be based on one of these did methods.
   *
   * The did methods are returned in the format `did:<method>`, e.g. `did:web`.
   *
   * The value is undefined in the case the supported did methods could not be extracted.
   * This is the case when an inline credential was used, or when the issuer didn't include
   * the supported did methods in the issuer metadata.
   *
   * NOTE: an empty array (no did methods supported) has a different meaning from the value
   * being undefined (the supported did methods could not be extracted). If `supportsAllDidMethods`
   * is true, the value of this property MUST be ignored.
   */
  supportedDidMethods?: string[]

  /**
   * Whether the issuer supports the `jwk` cryptographic binding method,
   * indicating they support proof of possession signatures bound to a jwk.
   */
  supportsJwk: boolean
}

/**
 * The proof of possession verification method resolver is a function that can be passed by the
 * user of the framework and allows them to determine which verification method should be used
 * for the proof of possession signature.
 */
export type OpenId4VciCredentialBindingResolver = (
  options: OpenId4VciCredentialBindingOptions
) => Promise<OpenId4VcCredentialHolderBinding> | OpenId4VcCredentialHolderBinding

/**
 * @internal
 */
export interface OpenId4VciProofOfPossessionRequirements {
  signatureAlgorithm: JwaSignatureAlgorithm
  supportedDidMethods?: string[]
  supportsAllDidMethods: boolean
  supportsJwk: boolean
}
