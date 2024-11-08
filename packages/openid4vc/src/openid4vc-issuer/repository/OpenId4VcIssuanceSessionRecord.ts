import type { OpenId4VciCredentialOfferPayload } from '../../shared'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { PkceCodeChallengeMethod } from '@animo-id/oauth2'
import { CredoError, BaseRecord, utils } from '@credo-ts/core'
import { Transform } from 'class-transformer'

import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'

export type OpenId4VcIssuanceSessionRecordTags = RecordTags<OpenId4VcIssuanceSessionRecord>

export type DefaultOpenId4VcIssuanceSessionRecordTags = {
  issuerId: string
  cNonce?: string
  state: OpenId4VcIssuanceSessionState
  credentialOfferUri: string

  // pre-auth flow
  preAuthorizedCode?: string

  // auth flow
  authorizationCode?: string
  issuerState?: string
}

export interface OpenId4VcIssuanceSessionRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  state: OpenId4VcIssuanceSessionState
  issuerId: string

  /**
   * @deprecated we now use a separate nonce store
   * as nonces are not session bound anymore
   */
  cNonce?: string
  /**
   * @deprecated we now use a separate nonce store
   * as nonces are not session bound anymore
   */
  cNonceExpiresAt?: Date

  dpopRequired?: boolean

  /**
   * Client id will mostly be used when doing auth flow
   */
  clientId?: string

  // Pre auth flow
  preAuthorizedCode?: string
  userPin?: string

  // Auth flow
  pkce?: {
    codeChallengeMethod: PkceCodeChallengeMethod
    codeChallenge: string
  }
  authorization?: {
    code?: string
    /**
     * String value created by the Credential Issuer and opaque to the Wallet that
     * is used to bind the subsequent Authorization Request with the Credential Issuer to a context set up during previous steps.
     */
    issuerState?: string
  }

  credentialOfferUri: string
  // FIXME: handle draft 11 structure (although they will have expired prob)
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

  public dpopRequired?: boolean

  /**
   * Authorization code flow specific metadata values
   */
  public authorization?: {
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
  }

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
  public credentialOfferUri!: string

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
      this.dpopRequired = props.dpopRequired
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
    }
  }
}
