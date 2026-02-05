import type { Express } from 'express'
import type {
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciDeferredCredentialRequestToCredentialMapper,
  OpenId4VciGetChainedAuthorizationRequestPayload,
  OpenId4VciGetVerificationSession,
} from './OpenId4VcIssuerServiceOptions'

const DEFAULT_C_NONCE_EXPIRES_IN = 1 * 60 // 1 minute
const DEFAULT_AUTHORIZATION_CODE_EXPIRES_IN = 1 * 60 // 1 minute
const DEFAULT_TOKEN_EXPIRES_IN = 3 * 60 // 3 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = 90 * 24 * 60 * 60 // 90 days
const DEFAULT_STATEFUL_CREDENTIAL_OFFER_EXPIRES_IN = 3 * 60 // 3 minutes
const DEFAULT_REQUEST_URI_EXPIRES_IN = 1 * 60 // 1 minute

export interface InternalOpenId4VcIssuerModuleConfigOptions {
  /**
   * Base url at which the issuer endpoints will be hosted. All endpoints will be exposed with
   * this path as prefix.
   */
  baseUrl: string

  /**
   * Express app on which the openid4vci endpoints will be registered.
   */
  app: Express

  /**
   * The time after which a cNonce will expire.
   *
   * @default 60 (1 minute)
   */
  cNonceExpiresInSeconds?: number

  /**
   * The time after which a stateful credential offer not bound to a subject expires. Once the offer has been bound
   * to a subject the access token expiration takes effect. This is to prevent long-lived `pre-authorized_code` and
   * `issuer_state` values.
   *
   * @default 180 (3 minutes)
   */
  statefulCredentialOfferExpirationInSeconds?: number

  /**
   * The time after which an authorization code will expire.
   *
   * @default 60 (1 minute)
   */
  authorizationCodeExpiresInSeconds?: number

  /**
   * The time after which an access token will expire.
   *
   * @default 180 (3 minutes)
   */
  accessTokenExpiresInSeconds?: number

  /**
   * The time after which a refresh token will expire.
   *
   * @default 7776000 (90 days)
   */
  refreshTokenExpiresInSeconds?: number

  /**
   * The time after which a pushed authorization request URI will expire.
   *
   * @default 60 (1 minute)
   */
  requestUriExpiresInSeconds?: number

  /**
   * Whether DPoP is required for all issuance sessions. This value can be overridden when creating
   * a credential offer. If dpop is not required, but used by a client in the first request to credo,
   * DPoP will be required going forward.
   *
   * @default false
   */
  dpopRequired?: boolean

  /**
   * Whether wallet attestations are required for all issuance sessions. This value can be overridden when creating
   * a credential offer, but will have effect for dynamic issuance sessions. If wallet attestations are not required
   * but used by a client in the first request to credo,
   * wallet attestations will be required going forward.
   *
   * @default false
   */
  walletAttestationsRequired?: boolean

  /**
   * Whether to allow dynamic issuance sessions based on a credential request.
   *
   * This requires an external authorization server which issues access tokens without
   * a `pre-authorized_code` or `issuer_state` parameter.
   *
   * Credo only support stateful credential offer sessions (pre-auth or presentation during issuance)
   *
   * @default false
   */
  allowDynamicIssuanceSessions?: boolean

  /**
   * A function mapping a credential request to the credential to be issued.
   *
   * When multiple credentials are returned it is recommended to use different or approximate issuance and expiration
   * times to prevent correlation based on the specific time
   */
  credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper

  /**
   * A function mapping a deferred credential request to the credential to be issued.
   *
   * When multiple credentials are returned it is recommended to use different or approximate issuance and expiration
   * times to prevent correlation based on the specific time
   */
  deferredCredentialRequestToCredentialMapper?: OpenId4VciDeferredCredentialRequestToCredentialMapper

  /**
   * @deprecated use `getVerificationSession` instead.
   */
  getVerificationSessionForIssuanceSessionAuthorization?: OpenId4VciGetVerificationSession

  /**
   * Callback to get a verification session that needs to be fulfilled for the authorization of
   * of a credential issuance session. Once the verification session has been completed the user can
   * retrieve an authorization code and access token and retrieve the credential(s).
   *
   * Required if presentation during issuance flow is used
   */
  getVerificationSession?: OpenId4VciGetVerificationSession

  /**
   * Callback to get additional details for the chained authorization server flow.
   * This will be called when a credential offer request is configured to use a chained
   * authorization server, but the scopesMapping configuration is not defined.
   *
   * Required if chained authorization server flow is used without a static scopes mapping configuration.
   */
  getChainedAuthorizationRequestPayload?: OpenId4VciGetChainedAuthorizationRequestPayload

  /**
   * Custom the paths used for endpoints
   */
  endpoints?: {
    /**
     * @default /nonce
     */
    nonce?: string

    /**
     * @default /challenge
     */
    authorizationChallenge?: string

    /**
     * @default /offers
     */
    credentialOffer?: string

    /**
     * @default /credential
     */
    credential?: string

    /**
     * @default /deferred-credential
     */
    deferredCredential?: string

    /**
     * @default /token
     */
    accessToken?: string

    /**
     * @default /par
     */
    pushedAuthorizationRequest?: string

    /**
     * @default /authorize
     */
    authorization?: string

    /**
     * @default /redirect
     */
    redirect?: string

    /**
     * @default /jwks
     */
    jwks: string
  }
}

export class OpenId4VcIssuerModuleConfig {
  private options: InternalOpenId4VcIssuerModuleConfigOptions

  /**
   * Callback to get a verification session that needs to be fulfilled for the authorization of
   * of a credential issuance session. Once the verification session has been completed the user can
   * retrieve an authorization code and access token and retrieve the credential(s).
   *
   * Required if presentation during issuance flow is used
   */
  public getVerificationSession?: OpenId4VciGetVerificationSession

  /**
   * Callback to get additional details for the chained authorization server flow.
   * This will be called when a credential offer request is configured to use a chained
   * authorization server, but the scopesMapping configuration is not defined.
   *
   * Required if chained authorization server flow is used without a static scopes mapping configuration.
   */
  public getChainedAuthorizationRequestPayload?: OpenId4VciGetChainedAuthorizationRequestPayload

  public constructor(options: InternalOpenId4VcIssuerModuleConfigOptions) {
    this.options = options
    this.getVerificationSession =
      options.getVerificationSession ?? options.getVerificationSessionForIssuanceSessionAuthorization
    this.getChainedAuthorizationRequestPayload = options.getChainedAuthorizationRequestPayload
  }

  public get app() {
    return this.options.app
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  public get credentialRequestToCredentialMapper() {
    return this.options.credentialRequestToCredentialMapper
  }

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  public get deferredCredentialRequestToCredentialMapper() {
    return this.options.deferredCredentialRequestToCredentialMapper
  }

  /**
   * The time after which a cNone will expire.
   *
   * @default 60 (1 minute)
   */
  public get cNonceExpiresInSeconds(): number {
    return this.options.cNonceExpiresInSeconds ?? DEFAULT_C_NONCE_EXPIRES_IN
  }

  /**
   * The time after which a stateful credential offer not bound to a subject expires. Once the offer has been bound
   * to a subject the access token expiration takes effect. This is to prevent long-lived `pre-authorized_code` and
   * `issuer_state` values.
   *
   * @default 360 (5 minutes)
   */
  public get statefulCredentialOfferExpirationInSeconds(): number {
    return this.options.statefulCredentialOfferExpirationInSeconds ?? DEFAULT_STATEFUL_CREDENTIAL_OFFER_EXPIRES_IN
  }

  /**
   * The time after which a cNonce will expire.
   *
   * @default 60 (1 minute)
   */
  public get authorizationCodeExpiresInSeconds(): number {
    return this.options.authorizationCodeExpiresInSeconds ?? DEFAULT_AUTHORIZATION_CODE_EXPIRES_IN
  }

  /**
   * The time after which an access token will expire.
   *
   * @default 180 (3 minutes)
   */
  public get accessTokenExpiresInSeconds(): number {
    return this.options.accessTokenExpiresInSeconds ?? DEFAULT_TOKEN_EXPIRES_IN
  }

  /**
   * The time after which a refresh token will expire.
   *
   * @default 7776000 (90 days)
   */
  public get refreshTokenExpiresInSeconds(): number {
    return this.options.refreshTokenExpiresInSeconds ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN
  }

  /**
   * The time after which a pushed authorization request URI will expire.
   *
   * @default 60 (1 minute)
   */
  public get requestUriExpiresInSeconds(): number {
    return this.options.requestUriExpiresInSeconds ?? DEFAULT_REQUEST_URI_EXPIRES_IN
  }

  /**
   * Whether DPoP is required for all issuance sessions. This value can be overridden when creating
   * a credential offer. If dpop is not required, but used by a client in the first request to credo,
   * DPoP will be required going forward.
   *
   * @default false
   */
  public get dpopRequired(): boolean {
    return this.options.dpopRequired ?? false
  }

  /**
   * Whether wallet attestations are required for all issuance sessions. This value can be overridden when creating
   * a credential offer, but will have effect for dynamic issuance sessions. If wallet attestations are not required
   * but used by a client in the first request to credo,
   * wallet attestations will be required going forward.
   *
   * @default false
   */
  public get walletAttestationsRequired(): boolean {
    return this.options.walletAttestationsRequired ?? false
  }

  /**
   * Whether to allow dynamic issuance sessions based on a credential request.
   *
   * This requires an external authorization server which issues access tokens without
   * a `pre-authorized_code` or `issuer_state` parameter.
   *
   * Credo only supports stateful credential offer sessions (pre-auth or presentation during issuance)
   *
   * @default false
   */
  public get allowDynamicIssuanceSessions(): boolean {
    return this.options.allowDynamicIssuanceSessions ?? false
  }

  /**
   * @default /nonce
   */
  public get nonceEndpointPath(): string {
    return this.options.endpoints?.nonce ?? '/nonce'
  }

  /**
   * @default /par
   */
  public get pushedAuthorizationRequestEndpoint(): string {
    return this.options.endpoints?.pushedAuthorizationRequest ?? '/par'
  }

  /**
   * @default /authorize
   */
  public get authorizationEndpoint(): string {
    return this.options.endpoints?.authorization ?? '/authorize'
  }

  /**
   * @default /redirect
   */
  public get redirectEndpoint(): string {
    return this.options.endpoints?.redirect ?? '/redirect'
  }

  /**
   * @default /challenge
   */
  public get authorizationChallengeEndpointPath(): string {
    return this.options.endpoints?.authorizationChallenge ?? '/challenge'
  }

  /**
   * @default /offers
   */
  public get credentialOfferEndpointPath(): string {
    return this.options.endpoints?.credentialOffer ?? '/offers'
  }

  /**
   * @default /credential
   */
  public get credentialEndpointPath(): string {
    return this.options.endpoints?.credential ?? '/credential'
  }

  /**
   * @default /deferred-credential
   */
  public get deferredCredentialEndpointPath(): string {
    return this.options.endpoints?.deferredCredential ?? '/deferred-credential'
  }

  /**
   * @default /token
   */
  public get accessTokenEndpointPath(): string {
    return this.options.endpoints?.accessToken ?? '/token'
  }

  /**
   * @default /jwks
   */
  public get jwksEndpointPath(): string {
    return this.options.endpoints?.jwks ?? '/jwks'
  }

  /**
   * @deprecated use `getVerificationSession` instead.
   */
  public get getVerificationSessionForIssuanceSessionAuthorization() {
    return this.getVerificationSession
  }

  /**
   * @deprecated use `getVerificationSession` instead.
   */
  public set getVerificationSessionForIssuanceSessionAuthorization(value:
    | OpenId4VciGetVerificationSession
    | undefined,) {
    this.getVerificationSession = value
  }
}
