import type { AgentContext, Kms, VerifiableCredential } from '@credo-ts/core'
import type { CredentialOfferObject, IssuerMetadataResult } from '@openid4vc/openid4vci'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VciAccessTokenResponse,
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciMetadata,
} from '../shared'

import { AuthorizationFlow as OpenId4VciAuthorizationFlow } from '@openid4vc/openid4vci'

import { OpenId4VciCredentialFormatProfile } from '../shared/models/OpenId4VciCredentialFormatProfile'

export { OpenId4VciAuthorizationFlow }

export type OpenId4VciSupportedCredentialFormats =
  | OpenId4VciCredentialFormatProfile.JwtVcJson
  | OpenId4VciCredentialFormatProfile.JwtVcJsonLd
  | OpenId4VciCredentialFormatProfile.SdJwtVc
  | OpenId4VciCredentialFormatProfile.SdJwtDc
  | OpenId4VciCredentialFormatProfile.LdpVc
  | OpenId4VciCredentialFormatProfile.MsoMdoc

export const openId4VciSupportedCredentialFormats: OpenId4VciSupportedCredentialFormats[] = [
  OpenId4VciCredentialFormatProfile.JwtVcJson,
  OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  OpenId4VciCredentialFormatProfile.SdJwtVc,
  OpenId4VciCredentialFormatProfile.SdJwtDc,
  OpenId4VciCredentialFormatProfile.LdpVc,
  OpenId4VciCredentialFormatProfile.MsoMdoc,
]

export interface OpenId4VciDpopRequestOptions {
  jwk: Kms.PublicJwk
  alg: Kms.KnownJwaSignatureAlgorithm
  nonce?: string
}

/**
 * 'credential_accepted' The Credential was successfully stored in the Wallet.
 * 'credential_deleted' when the unsuccessful Credential issuance was caused by a user action.
 * 'credential_failure' otherwise.
 */
export type OpenId4VciNotificationEvent = 'credential_accepted' | 'credential_failure' | 'credential_deleted'

export type OpenId4VciRequestTokenResponse = {
  accessToken: string
  cNonce?: string
  dpop?: OpenId4VciDpopRequestOptions

  accessTokenResponse: OpenId4VciAccessTokenResponse
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type UnionToArrayUnion<T> = T extends any ? T[] : never

export interface OpenId4VciCredentialResponse {
  credentialConfigurationId: string
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
  credentials: UnionToArrayUnion<VerifiableCredential>
  notificationId?: string
}

export interface OpenId4VciDeferredCredentialResponse {
  credentialConfigurationId: string
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
  transactionId: string
  interval?: number
  notificationId?: string
}

export interface OpenId4VciResolvedCredentialOffer {
  metadata: IssuerMetadataResult
  credentialOfferPayload: CredentialOfferObject

  /**
   * Offered credential configurations with known formats
   */
  offeredCredentialConfigurations: OpenId4VciCredentialConfigurationsSupportedWithFormats
}

export type OpenId4VciResolvedAuthorizationRequest =
  | {
      openid4vpRequestUrl: string
      authorizationFlow: OpenId4VciAuthorizationFlow.PresentationDuringIssuance
      authSession: string

      /**
       * DPoP request options if DPoP was used for the authorization challenge request
       */
      dpop?: OpenId4VciDpopRequestOptions
    }
  | {
      authorizationRequestUrl: string
      authorizationFlow: OpenId4VciAuthorizationFlow.Oauth2Redirect
      codeVerifier?: string

      /**
       * DPoP request options if DPoP was used for the pushed authorization reuqest
       */
      dpop?: OpenId4VciDpopRequestOptions
    }

export interface OpenId4VciSendNotificationOptions {
  metadata: IssuerMetadataResult

  notificationId: string

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

  dpop?: OpenId4VciDpopRequestOptions
}

export interface OpenId4VcAuthorizationCodeTokenRequestOptions {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  code: string
  clientId: string
  codeVerifier?: string
  redirectUri?: string

  txCode?: never

  /**
   * DPoP parameters to use in the request if supported by the authorization server.
   *
   * If DPoP was already used in the initiateAuthorization method, it should be provided
   * here as well and be bound to the same key.
   */
  dpop?: OpenId4VciDpopRequestOptions

  /**
   * The wallet attestation to send to the issuer. This will only be used
   * if client attestations are supported by the issuer, and should be provided
   * if wallet attestation was provided in the authorization request as well.
   *
   * A Proof of Possesion will be created based on the wallet attestation,
   * so the key bound to the wallet attestation must be in the wallet.
   */
  walletAttestationJwt?: string
}

// TODO: support wallet attestation for pre-auth flow
export interface OpenId4VciPreAuthorizedTokenRequestOptions {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  txCode?: string

  code?: undefined

  /**
   * DPoP parameters to use in the request if supported by the authorization server.
   */
  dpop?: OpenId4VciDpopRequestOptions

  /**
   * The wallet attestation to send to the issuer. This will only be used
   * if client attestations are supported by the issuer.
   *
   * A Proof of Possesion will be created based on the wallet attestation,
   * so the key bound to the wallet attestation must be in the wallet.
   */
  walletAttestationJwt?: string
}

export type OpenId4VciTokenRequestOptions =
  | OpenId4VciPreAuthorizedTokenRequestOptions
  | OpenId4VcAuthorizationCodeTokenRequestOptions

export interface OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  dpop?: OpenId4VciDpopRequestOptions

  /**
   * The wallet attestation to send to the issuer. This will only be used
   * if client attestations are supported by the issuer, and should be provided
   * if wallet attestation was provided in the authorization request as well.
   *
   * A Proof of Possesion will be created based on the wallet attestation,
   * so the key bound to the wallet attestation must be in the wallet.
   */
  walletAttestationJwt?: string

  /**
   * auth session returned at an earlier call to the authorization challenge endpoint
   */
  authSession: string

  /**
   * Presentation during issuance session returned by the verifier after submitting a valid presentation
   */
  presentationDuringIssuanceSession?: string
}

export interface OpenId4VciCredentialRequestOptions extends Omit<OpenId4VciAcceptCredentialOfferOptions, 'userPin'> {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  accessToken: string
  cNonce?: string
  dpop?: OpenId4VciDpopRequestOptions

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
   * This is the list of credentials configuration ids that will be requested from the issuer.
   * Should be a list of ids of the credentials that are included in the credential offer.
   * If not provided all offered credentials will be requested.
   */
  credentialConfigurationIds?: string[]

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
  allowedProofOfPossessionSignatureAlgorithms?: Kms.KnownJwaSignatureAlgorithm[]

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
 * Options to request deferred credentials from the issuer.
 */
export interface OpenId4VciDeferredCredentialRequestOptions {
  issuerMetadata: IssuerMetadataResult
  transactionId: string
  credentialConfigurationId: string
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
  verifyCredentialStatus?: boolean
  accessToken: string
  dpop?: OpenId4VciDpopRequestOptions
}

/**
 * Options that are used for the authorization code flow.
 */
export interface OpenId4VciAuthCodeFlowOptions {
  clientId: string

  /**
   * The wallet attestation to send to the issuer. This will only be used
   * if client attestations and PAR are supported by the issuer.
   *
   * A Proof of Possesion will be created based on the wallet attestation,
   * so the key bound to the wallet attestation must be in the wallet.
   */
  walletAttestationJwt?: string

  redirectUri: string
  scope?: string[]
}

export interface OpenId4VciCredentialBindingOptions {
  agentContext: AgentContext

  /**
   * The OpenID4VCI metadata, consisting of the draft version used,
   * the issuer metadatan and the authorization server metadata
   */
  metadata: OpenId4VciMetadata

  /**
   * The credential format that will be requested from the issuer.
   * E.g. `jwt_vc` or `ldp_vc`.
   */
  credentialFormat: OpenId4VciSupportedCredentialFormats

  /**
   * The max batch size as configured by the issuer. If the issuer has not indicated support for batch issuance
   * this will be `1`.
   */
  issuerMaxBatchSize: number

  /**
   * The proof types supported by the credential issuer that are also supported
   * by credo. Currently `jwt` and `attestation` are supported.
   *
   * Each proof type will list the supported algorithms, key types
   * and whether key attesations are required
   */
  proofTypes: OpenId4VciProofOfPressionProofTypes

  /**
   * The id of the credential configuration that will be requested from the issuer.
   */
  credentialConfigurationId: string

  /**
   * The credential configuration that will be requested from the issuer.
   */
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats

  /**
   * Whether the issuer supports the `did` cryptographic binding method,
   * indicating they support all did methods. In most cases, they do not
   * support all did methods, and it means we have to make an assumption
   * about the did methods they support.
   *
   * If this value is `false`, the `supportedDidMethods` property will
   * contain a list of supported did methods.
   *
   * NOTE: when key attestations are required for a specific proof type, support for did method
   * binding is not supported at the moment, as there's no way to indicate which did the credential
   * should be bound to.
   * https://github.com/openid/OpenID4VCI/issues/475
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
   * This is the case when the issuer didn't include the supported did methods in the issuer metadata.
   *
   * NOTE: an empty array (no did methods supported) has a different meaning from the value
   * being undefined (the supported did methods could not be extracted). If `supportsAllDidMethods`
   * is true, the value of this property MUST be ignored.
   *
   * NOTE: when key attestations are required for a specific proof type, support for did method
   * binding is not supported at the moment, as there's no way to indicate which did the credential
   * should be bound to.
   * https://github.com/openid/OpenID4VCI/issues/475
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

export type OpenId4VciProofOfPressionProofTypes = Record<
  'jwt' | 'attestation',
  | {
      /**
       * The JWA Signature Algorithm(s) that can be used in the proof of possession.
       * This is based on the `allowedProofOfPossessionSignatureAlgorithms` passed
       * to the request credential method, and the supported proof type signature
       * algorithms for the specific credential configuration
       */
      supportedSignatureAlgorithms: Kms.KnownJwaSignatureAlgorithm[]

      /**
       * Whether key attestations are required and which level needs to be met. If the object
       * is not defined, it can be interpreted that key attestations are not required.
       *
       * OpenID4VCI defined common levels in https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-D.2, such as:
       * - `iso_18045_high`
       * - `iso_18045_moderate`
       * - `iso_18045_enhanced-basic`
       * - `iso_18045_basic`
       *
       * Other values may be defined and present as well. When key attestations are required you MUST return a key attestation.
       * If `userAuthentication` or `keyStorage` are defined you MUST return a key attestation that reaches the level as required
       *  by the `keyStorage` and `userAuthentication` values.
       */
      keyAttestationsRequired?: {
        keyStorage?: string[]
        userAuthentication?: string[]
      }
    }
  | undefined
>

/**
 * @internal
 */
export interface OpenId4VciProofOfPossessionRequirements {
  proofTypes: OpenId4VciProofOfPressionProofTypes
  supportedDidMethods?: string[]
  supportsAllDidMethods: boolean
  supportsJwk: boolean
}
