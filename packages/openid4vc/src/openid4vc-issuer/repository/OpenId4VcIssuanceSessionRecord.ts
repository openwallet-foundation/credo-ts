import type { RecordTags, TagsBase } from '@credo-ts/core'
import { BaseRecord, CredoError, DateTransformer, isJsonObject, utils } from '@credo-ts/core'
import { type AccessTokenResponse, type AuthorizationServerMetadata, PkceCodeChallengeMethod } from '@openid4vc/oauth2'
import { Transform, TransformationType } from 'class-transformer'
import type { OpenId4VciCredentialOfferPayload } from '../../shared'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import type { OpenId4VciVersion } from '../OpenId4VcIssuerServiceOptions'

export type OpenId4VcIssuanceSessionRecordTags = RecordTags<OpenId4VcIssuanceSessionRecord>

export interface OpenId4VcIssuanceSessionDpop {
  /**
   * Whether dpop is required. Can be set to false to override the
   * global config
   */
  required: boolean

  /**
   * JWK thumbprint of the dpop key. This is mostly used when a dpop key is bound
   * to the issuance session before the access token is created (which contains the dpop key)
   */
  dpopJkt?: string
}

export interface OpenId4VcIssuanceSessionWalletAttestation {
  /**
   * Whether presentation of a wallet attestation is required.
   * Can be set to false to override the global config
   */
  required: boolean
}

export interface OpenId4VcIssuanceSessionAuthorization {
  code?: string

  /**
   * @todo: I saw in google's library that for codes they encrypt an id with expiration time.
   * You know the code was created by you because you can decrypt it, and you don't have to store
   * additional metadata on your server. It's similar to the signed / encrypted nonce
   */
  codeExpiresAt?: Date

  /**
   * String value created by the Credential Issuer and opaque to the Wallet that
   * is used to bind the subsequent Authorization Request with the Credential Issuer to a context set up during previous steps.
   */
  issuerState?: string

  /**
   * Scopes that are granted when the authorization is complete.
   */
  scopes?: string[]

  /**
   * Subject the issuance session is bound to. For internal authorization this will be defined
   * from the moment the token is issued. For external authorization this will be defined after
   * the first time the credential endpoint has been called.
   */
  subject?: string
}

export interface OpenId4VcIssuanceSessionPresentation {
  /**
   * Whether presentation during issuance is required. Mutually exclusive with `chainedIdentity`.
   */
  required: true

  /**
   * Auth session for the presentation during issuance flow
   */
  authSession?: string

  /**
   * The id of the `OpenId4VcVerificationSessionRecord` record this issuance session is linked to
   */
  openId4VcVerificationSessionId?: string
}

export interface OpenId4VcIssuanceSessionPkce {
  codeChallengeMethod: PkceCodeChallengeMethod
  codeChallenge: string
}

export interface OpenId4VcIssuanceSessionChainedIdentity {
  /**
   * The identifier of the external identity provider's authorization server.
   * Mutually exclusive with `presentation`.
   */
  externalAuthorizationServerUrl: string

  /**
   * The <reference-value> from the `request_uri` parameter returned to the client
   * in the form of `urn:ietf:params:oauth:request_uri:<reference-value>`.
   */
  requestUriReferenceValue?: string

  /**
   * The expiry time of the request URI.
   *
   * @todo: I saw in google's library that for codes they encrypt an id with expiration time.
   * You know the code was created by you because you can decrypt it, and you don't have to store
   * additional metadata on your server. It's similar to the signed / encrypted nonce
   */
  requestUriExpiresAt?: Date

  /**
   * The state value that was received in the pushed authorization request.
   */
  state?: string

  /**
   * The redirect uri to redirect to after the authorization code has been granted.
   */
  redirectUri?: string

  /**
   * The PKCE code verifier used in the authorization request to the external identity provider.
   */
  pkceCodeVerifier?: string

  /**
   * The chained identity authorization request url, used to authorize to the external identity provider.
   */
  externalAuthorizationRequestUrl?: string

  /**
   * The state value used in the authorization request to the external identity provider.
   */
  externalState?: string

  /**
   * The metadata of the external identity provider's authorization server.
   */
  externalAuthorizationServerMetadata?: AuthorizationServerMetadata

  /**
   * The access token response received from the external identity provider.
   *
   * If the scope 'openid' is requested, we automatically verify if the
   * ID Token JWT is valid.
   */
  externalAccessTokenResponse?: AccessTokenResponse
}

export type DefaultOpenId4VcIssuanceSessionRecordTags = {
  issuerId: string
  cNonce?: string
  state: OpenId4VcIssuanceSessionState
  credentialOfferUri?: string
  credentialOfferId?: string

  // pre-auth flow
  preAuthorizedCode?: string

  // auth flow
  authorizationCode?: string
  issuerState?: string

  authorizationSubject?: string

  // presentation during issuance
  presentationAuthSession?: string

  // identity chaining
  chainedIdentityRequestUriReferenceValue?: string
  chainedIdentityState?: string
}

export interface OpenId4VcIssuanceSessionRecordTransaction {
  transactionId: string

  // The expected number of credentials that will be issued in this transaction
  numberOfCredentials: number

  // The credential configuration that is used for this transaction.
  credentialConfigurationId: string
}

export interface OpenId4VcIssuanceSessionRecordProps {
  createdAt: Date
  expiresAt: Date

  id?: string
  tags?: TagsBase

  state: OpenId4VcIssuanceSessionState
  issuerId: string

  /**
   * Client id will mostly be used when doing auth flow
   */
  clientId?: string

  walletAttestation?: OpenId4VcIssuanceSessionWalletAttestation
  dpop?: OpenId4VcIssuanceSessionDpop

  // Pre auth flow
  preAuthorizedCode?: string
  userPin?: string

  // Auth flow (move to authorization?)
  pkce?: {
    codeChallengeMethod: PkceCodeChallengeMethod
    codeChallenge: string
  }

  /**
   * When authorization code flow is used, this links the authorization
   */
  authorization?: OpenId4VcIssuanceSessionAuthorization

  /**
   * When presentation during issuance is required this should link the
   * `OpenId4VcVerificationSessionRecord` and state
   */
  presentation?: OpenId4VcIssuanceSessionPresentation

  // Transaction data for deferred credential issuances
  transactions?: OpenId4VcIssuanceSessionRecordTransaction[]

  /**
   * Identity chaining enables doing another OAuth2 authentication flow as part
   * of the OpenID4VCI authorization flow. This allows leveraging the advanced OAuth2
   * functionality from Credo (e.g. Wallet Attestations, DPoP, PAR) while still allowing
   * integration with existing IDPs.
   */
  chainedIdentity?: OpenId4VcIssuanceSessionChainedIdentity

  credentialOfferUri?: string
  credentialOfferId: string

  credentialOfferPayload: OpenId4VciCredentialOfferPayload

  issuanceMetadata?: Record<string, unknown>
  errorMessage?: string

  generateRefreshTokens?: boolean

  /**
   * The version of openid4ci used for the request
   */
  openId4VciVersion: OpenId4VciVersion
}

export class OpenId4VcIssuanceSessionRecord extends BaseRecord<DefaultOpenId4VcIssuanceSessionRecordTags> {
  public static readonly type = 'OpenId4VcIssuanceSessionRecord'
  public readonly type = OpenId4VcIssuanceSessionRecord.type

  /**
   * Expiry time for the issuance session. This can change dynamically during
   * the session lifetime, based on the possible deferrals.
   *
   * @since 0.6
   */
  @DateTransformer()
  public expiresAt?: Date

  /**
   * The id of the issuer that this session is for.
   */
  public issuerId!: string

  /**
   * The state of the issuance session.
   */
  @Transform(({ value }) => {
    // CredentialIssued is an old state that is no longer used. It should be mapped to Error.
    if (value === 'CredentialIssued') {
      return OpenId4VcIssuanceSessionState.Error
    }

    return value
  })
  public state!: OpenId4VcIssuanceSessionState

  /**
   * The credentials that were issued during this session.
   */
  public issuedCredentials: string[] = []

  /**
   * The credential transactions for deferred credentials.
   */
  public transactions: OpenId4VcIssuanceSessionRecordTransaction[] = []

  /**
   * Pre authorized code used for the issuance session. Only used when a pre-authorized credential
   * offer is created.
   */
  public preAuthorizedCode?: string

  /**
   * Optional user pin that needs to be provided by the user in the access token request.
   */
  public userPin?: string

  /**
   * Client id of the exchange
   */
  public clientId?: string

  /**
   * Proof Key Code Exchange
   */
  public pkce?: OpenId4VcIssuanceSessionPkce

  walletAttestation?: OpenId4VcIssuanceSessionWalletAttestation
  dpop?: OpenId4VcIssuanceSessionDpop

  /**
   * Authorization code flow specific metadata values
   */
  @Transform(({ type, value }) => {
    if (type === TransformationType.PLAIN_TO_CLASS && isJsonObject(value) && typeof value.codeExpiresAt === 'string') {
      return {
        ...value,
        codeExpiresAt: new Date(value.codeExpiresAt),
      }
    }
    if (type === TransformationType.CLASS_TO_CLASS && isJsonObject(value) && value.codeExpiresAt instanceof Date) {
      return {
        ...value,
        codeExpiresAt: new Date(value.codeExpiresAt.getTime()),
      }
    }
    if (type === TransformationType.CLASS_TO_PLAIN && isJsonObject(value) && value.codeExpiresAt instanceof Date) {
      return {
        ...value,
        codeExpiresAt: value.codeExpiresAt.toISOString(),
      }
    }

    return value
  })
  public authorization?: OpenId4VcIssuanceSessionAuthorization

  /**
   * Presentation during issuance specific metadata values
   */
  public presentation?: OpenId4VcIssuanceSessionPresentation

  /**
   * Chained identity specific metadata values
   */
  @Transform(({ type, value }) => {
    if (
      type === TransformationType.PLAIN_TO_CLASS &&
      isJsonObject(value) &&
      typeof value.requestUriExpiresAt === 'string'
    ) {
      return {
        ...value,
        requestUriExpiresAt: new Date(value.requestUriExpiresAt),
      }
    }
    if (
      type === TransformationType.CLASS_TO_CLASS &&
      isJsonObject(value) &&
      value.requestUriExpiresAt instanceof Date
    ) {
      return {
        ...value,
        requestUriExpiresAt: new Date(value.requestUriExpiresAt.getTime()),
      }
    }
    if (
      type === TransformationType.CLASS_TO_PLAIN &&
      isJsonObject(value) &&
      value.requestUriExpiresAt instanceof Date
    ) {
      return {
        ...value,
        requestUriExpiresAt: value.requestUriExpiresAt.toISOString(),
      }
    }

    return value
  })
  public chainedIdentity?: OpenId4VcIssuanceSessionChainedIdentity

  /**
   * User-defined metadata that will be provided to the credential request to credential mapper
   * to allow to retrieve the needed credential input data. Can be the credential data itself,
   * or some other data that is needed to retrieve the credential data.
   */
  public issuanceMetadata?: Record<string, unknown>

  /**
   * The credential offer that was used to create the issuance session.
   */
  public credentialOfferPayload!: OpenId4VciCredentialOfferPayload

  /**
   * URI of the credential offer. This is the url that cn can be used to retrieve
   * the credential offer
   */
  public credentialOfferUri?: string

  /**
   * The public id for the credential offer. This is used in the credential
   * offer uri.
   *
   * @since 0.6
   */
  public credentialOfferId?: string

  /**
   * Whether to generate refresh tokens for the issuance session.
   *
   * @since 0.6
   */
  public generateRefreshTokens?: boolean

  /**
   * The version of openid4ci used for the request
   *
   * @since 0.6
   */
  public openId4VciVersion?: OpenId4VciVersion

  /**
   * Optional error message of the error that occurred during the issuance session. Will be set when state is {@link OpenId4VcIssuanceSessionState.Error}
   */
  public errorMessage?: string

  public constructor(props: OpenId4VcIssuanceSessionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt
      this.expiresAt = props.expiresAt
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.clientId = props.clientId
      this.userPin = props.userPin
      this.preAuthorizedCode = props.preAuthorizedCode
      this.pkce = props.pkce
      this.authorization = props.authorization
      this.presentation = props.presentation
      this.chainedIdentity = props.chainedIdentity
      this.credentialOfferUri = props.credentialOfferUri
      this.credentialOfferId = props.credentialOfferId
      this.credentialOfferPayload = props.credentialOfferPayload
      this.issuanceMetadata = props.issuanceMetadata
      this.dpop = props.dpop
      this.walletAttestation = props.walletAttestation
      this.state = props.state
      this.generateRefreshTokens = props.generateRefreshTokens
      this.errorMessage = props.errorMessage
      this.transactions = props.transactions ?? []
      this.openId4VciVersion = props.openId4VciVersion
    }
  }

  public assertState(expectedStates: OpenId4VcIssuanceSessionState | OpenId4VcIssuanceSessionState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `OpenId4VcIssuanceSessionRecord is in invalid state ${this.state}. Valid states are: ${expectedStates.join(
          ', '
        )}.`
      )
    }
  }

  public getTags() {
    return {
      ...this._tags,
      issuerId: this.issuerId,
      credentialOfferUri: this.credentialOfferUri,
      credentialOfferId: this.credentialOfferId,
      state: this.state,

      // Pre-auth flow
      preAuthorizedCode: this.preAuthorizedCode,

      // Auth flow
      issuerState: this.authorization?.issuerState,
      authorizationCode: this.authorization?.code,

      authorizationSubject: this.authorization?.subject,

      // Presentation during issuance
      presentationAuthSession: this.presentation?.authSession,

      // Chained identity
      chainedIdentityRequestUriReferenceValue: this.chainedIdentity?.requestUriReferenceValue,
      chainedIdentityState: this.chainedIdentity?.externalState,
    }
  }
}
