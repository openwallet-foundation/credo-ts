import type { OpenId4VpAuthorizationRequestPayload, OpenId4VpAuthorizationResponsePayload } from '../../shared/models'
import type { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'

import { BaseRecord, CredoError, DateTransformer, Jwt, RecordTags, TagsBase, utils } from '@credo-ts/core'
import { OpenId4VpVersion } from '../OpenId4VpVerifierServiceOptions'

export type OpenId4VcVerificationSessionRecordTags = RecordTags<OpenId4VcVerificationSessionRecord>

export type DefaultOpenId4VcVerificationSessionRecordTags = {
  verifierId: string
  state: OpenId4VcVerificationSessionState
  nonce: string
  payloadState?: string
  authorizationRequestUri?: string
  authorizationRequestId?: string
  openId4VpVersion?: OpenId4VpVersion
}

export interface OpenId4VcVerificationSessionRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  verifierId: string
  state: OpenId4VcVerificationSessionState
  errorMessage?: string

  authorizationRequestJwt?: string
  authorizationRequestUri?: string
  authorizationRequestId: string
  authorizationRequestPayload?: OpenId4VpAuthorizationRequestPayload

  authorizationResponseRedirectUri?: string

  expiresAt: Date

  authorizationResponsePayload?: OpenId4VpAuthorizationResponsePayload

  /**
   * Presentation during issuance session. This is used when issuance of a credential requires a presentation, and helps
   * prevent session fixation attacks
   */
  presentationDuringIssuanceSession?: string

  /**
   * The version of openid4vp used for the request
   */
  openId4VpVersion: OpenId4VpVersion
}

export class OpenId4VcVerificationSessionRecord extends BaseRecord<DefaultOpenId4VcVerificationSessionRecordTags> {
  public static readonly type = 'OpenId4VcVerificationSessionRecord'
  public readonly type = OpenId4VcVerificationSessionRecord.type

  /**
   * The id of the verifier that this session is for.
   */
  public verifierId!: string

  /**
   * The state of the verification session.
   */
  public state!: OpenId4VcVerificationSessionState

  /**
   * Optional error message of the error that occurred during the verification session. Will be set when state is {@link OpenId4VcVerificationSessionState.Error}
   */
  public errorMessage?: string

  /**
   * The signed JWT containing the authorization request
   */
  public authorizationRequestJwt?: string

  /**
   * Authorization request payload. This should be used only for unsigned requests
   */
  public authorizationRequestPayload?: OpenId4VpAuthorizationRequestPayload

  /**
   * URI of the authorization request. This is the url that can be used to
   * retrieve the authorization request.
   *
   * Not used for requests with response_mode of dc_api or dc_api.jwt
   */
  public authorizationRequestUri?: string

  /**
   * The public id for the authorization request. This is used in the authorization
   * request uri.
   *
   * @since 0.6
   */
  public authorizationRequestId?: string

  /**
   * The version of OpenID4VP used.
   *
   * If `v1` is used this is always defined. Otherwise it could be both
   * `v1.draft21` or `v1.draft24`.
   *
   * You can detect this based on:
   * - if `client_id_scheme` is defined -> `v1.draft21`
   * - otherwise `v1.draft24`
   *
   * @since 0.6
   */
  public openId4VpVersion?: OpenId4VpVersion

  /**
   * The time at which the authorization request expires.
   *
   * @since 0.6
   */
  @DateTransformer()
  public expiresAt?: Date

  /**
   * The payload of the received authorization response
   */
  public authorizationResponsePayload?: OpenId4VpAuthorizationResponsePayload

  /**
   * Presentation during issuance session. This is used when issuance of a credential requires a presentation, and helps
   * prevent session fixation attacks
   */
  public presentationDuringIssuanceSession?: string

  /**
   * Redirect uri that should be used in the authorization response. This will be included in both error and success
   * responses.
   *
   * @since 0.6
   */
  authorizationResponseRedirectUri?: string

  public constructor(props: OpenId4VcVerificationSessionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.verifierId = props.verifierId
      this.state = props.state
      this.errorMessage = props.errorMessage
      this.authorizationRequestPayload = props.authorizationRequestPayload
      this.authorizationRequestJwt = props.authorizationRequestJwt
      this.authorizationRequestUri = props.authorizationRequestUri
      this.authorizationRequestId = props.authorizationRequestId
      this.authorizationResponseRedirectUri = props.authorizationResponseRedirectUri
      this.authorizationResponsePayload = props.authorizationResponsePayload
      this.expiresAt = props.expiresAt
      this.openId4VpVersion = props.openId4VpVersion

      this.presentationDuringIssuanceSession = props.presentationDuringIssuanceSession
    }
  }

  public get request(): string | OpenId4VpAuthorizationRequestPayload {
    if (this.authorizationRequestJwt) return this.authorizationRequestJwt
    if (this.authorizationRequestPayload) return this.authorizationRequestPayload

    throw new CredoError('Unable to extract authorization payload from openid4vc session record')
  }

  public get requestPayload(): OpenId4VpAuthorizationRequestPayload {
    if (this.authorizationRequestJwt)
      return Jwt.fromSerializedJwt(
        this.authorizationRequestJwt
      ).payload.toJson() as OpenId4VpAuthorizationRequestPayload
    if (this.authorizationRequestPayload) return this.authorizationRequestPayload

    throw new CredoError('Unable to extract authorization payload from openid4vc session record')
  }

  public assertState(expectedStates: OpenId4VcVerificationSessionState | OpenId4VcVerificationSessionState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `OpenId4VcVerificationSessionRecord is in invalid state ${this.state}. Valid states are: ${expectedStates.join(
          ', '
        )}.`
      )
    }
  }

  public getTags() {
    const request = this.requestPayload

    const nonce = request.nonce
    const payloadState = 'state' in request ? (request.state as string) : undefined

    return {
      ...this._tags,
      verifierId: this.verifierId,
      state: this.state,
      nonce,
      payloadState,
      authorizationRequestUri: this.authorizationRequestUri,
      authorizationRequestId: this.authorizationRequestId,
      openId4VpVersion: this.openId4VpVersion,
    }
  }
}
