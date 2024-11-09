import type {
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciGetVerificationSessionForIssuanceSessionAuthorization,
} from './OpenId4VcIssuerServiceOptions'
import type { Router } from 'express'

import { importExpress } from '../shared/router'

const DEFAULT_C_NONCE_EXPIRES_IN = 1 * 60 // 1 minute
const DEFAULT_AUTHORIZATION_CODE_EXPIRES_IN = 1 * 60 // 1 minute
const DEFAULT_TOKEN_EXPIRES_IN = 3 * 60 // 3 minutes
const DEFAULT_PRE_AUTH_CODE_EXPIRES_IN = 3 * 60 // 3 minutes

export interface OpenId4VcIssuerModuleConfigOptions {
  /**
   * Base url at which the issuer endpoints will be hosted. All endpoints will be exposed with
   * this path as prefix.
   */
  baseUrl: string

  /**
   * Express router on which the openid4vci endpoints will be registered. If
   * no router is provided, a new one will be created.
   *
   * NOTE: you must manually register the router on your express app and
   * expose this on a public url that is reachable when `baseUrl` is called.
   */
  router?: Router

  /**
   * The time after which a cNonce will expire.
   *
   * @default 60 (1 minute)
   */
  cNonceExpiresInSeconds?: number

  /**
   * The time after which an pre-authorized code will expire.
   *
   * @default 360 (5 minutes)
   */
  preAuthorizedCodeExpirationInSeconds?: number

  /**
   * The time after which an authorization code will expire.
   *
   * @default 60 (1 minute)
   */
  authorizationCodeExpiresInSeconds?: number

  /**
   * The time after which an access token will expire.
   *
   * @default 360 (5 minutes)
   */
  accessTokenExpiresInSeconds?: number

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper

  /**
   * Callback to get a verification session that needs to be fulfilled for the authorization of
   * of a credential issuance session. Once the verification session has been completed the user can
   * retrieve an authorization code and access token and retrieve the credential(s).
   *
   * Required if presentation during issuance flow is used
   */
  getVerificationSessionForIssuanceSessionAuthorization?: OpenId4VciGetVerificationSessionForIssuanceSessionAuthorization

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
     * @default /token
     */
    accessToken?: string

    /**
     * @default /jwks
     */
    jwks: string
  }
}

export class OpenId4VcIssuerModuleConfig {
  private options: OpenId4VcIssuerModuleConfigOptions
  public readonly router: Router

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.options = options

    this.router = options.router ?? importExpress().Router()
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
   * Callback to get a verification session that needs to be fulfilled for the authorization of
   * of a credential issuance session. Once the verification session has been completed the user can
   * retrieve an authorization code and access token and retrieve the credential(s).
   *
   * Required if presentation during issuance flow is used
   */
  public get getVerificationSessionForIssuanceSessionAuthorization() {
    return this.options.getVerificationSessionForIssuanceSessionAuthorization
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
   * The time after which a pre-authorized_code will expire.
   *
   * @default 360 (5 minutes)
   */
  public get preAuthorizedCodeExpirationInSeconds(): number {
    return this.options.preAuthorizedCodeExpirationInSeconds ?? DEFAULT_PRE_AUTH_CODE_EXPIRES_IN
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
   * @default 360 (5 minutes)
   */
  public get accessTokenExpiresInSeconds(): number {
    return this.options.accessTokenExpiresInSeconds ?? DEFAULT_TOKEN_EXPIRES_IN
  }

  /**
   * @default /nonce
   */
  public get nonceEndpointPath(): string {
    return this.options.endpoints?.nonce ?? '/nonce'
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
}
