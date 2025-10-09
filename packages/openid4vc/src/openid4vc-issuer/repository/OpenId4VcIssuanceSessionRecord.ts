import type { OpenId4VciCredentialOfferPayload } from '../../shared'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { PkceCodeChallengeMethod } from '@animo-id/oauth2'
import { CredoError, BaseRecord, utils, isJsonObject } from '@credo-ts/core'
import { Transform, TransformationType } from 'class-transformer'

import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'

export type OpenId4VcIssuanceSessionRecordTags = RecordTags<OpenId4VcIssuanceSessionRecord>

export interface OpenId4VcIssuanceSessionAuthorization {
  code?: string

  /**
   * @todo: I saw in google's library that for codes they encrypt an id with expiration time.
   * You now the code was created by you because you can decrypt it, and you don't have to store
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
   * Whether presentation during issuance is required.
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

export type DefaultOpenId4VcIssuanceSessionRecordTags = {
  issuerId: string
  cNonce?: string
  state: OpenId4VcIssuanceSessionState
  credentialOfferUri?: string

  // pre-auth flow
  preAuthorizedCode?: string

  // auth flow
  authorizationCode?: string
  issuerState?: string

  authorizationSubject?: string

  // presentation during issuance
  presentationAuthSession?: string
}

export interface OpenId4VcIssuanceSessionRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  state: OpenId4VcIssuanceSessionState
  issuerId: string

  /**
   * Client id will mostly be used when doing auth flow
   */
  clientId?: string

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

  credentialOfferUri?: string

  credentialOfferPayload: OpenId4VciCredentialOfferPayload

  issuanceMetadata?: Record<string, unknown>
  errorMessage?: string
}

export class OpenId4VcIssuanceSessionRecord extends BaseRecord<DefaultOpenId4VcIssuanceSessionRecordTags> {
  public static readonly type = 'OpenId4VcIssuanceSessionRecord'
  public readonly type = OpenId4VcIssuanceSessionRecord.type

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
  public pkce?: {
    codeChallengeMethod: PkceCodeChallengeMethod
    codeChallenge: string
  }

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
   * Optional error message of the error that occurred during the issuance session. Will be set when state is {@link OpenId4VcIssuanceSessionState.Error}
   */
  public errorMessage?: string

  public constructor(props: OpenId4VcIssuanceSessionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.issuerId = props.issuerId
      this.clientId = props.clientId
      this.userPin = props.userPin
      this.preAuthorizedCode = props.preAuthorizedCode
      this.pkce = props.pkce
      this.authorization = props.authorization
      this.credentialOfferUri = props.credentialOfferUri
      this.credentialOfferPayload = props.credentialOfferPayload
      this.issuanceMetadata = props.issuanceMetadata
      this.state = props.state
      this.errorMessage = props.errorMessage
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
      state: this.state,

      // Pre-auth flow
      preAuthorizedCode: this.preAuthorizedCode,

      // Auth flow
      issuerState: this.authorization?.issuerState,
      authorizationCode: this.authorization?.code,

      authorizationSubject: this.authorization?.subject,

      // Presentation during issuance
      presentationAuthSession: this.presentation?.authSession,
    }
  }
}
