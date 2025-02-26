import type {
  OpenId4VcSiopAuthorizationRequestPayload,
  OpenId4VcSiopAuthorizationResponsePayload,
} from '../../shared/models'
import type { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { Jwt, CredoError, BaseRecord, utils } from '@credo-ts/core'

export type OpenId4VcVerificationSessionRecordTags = RecordTags<OpenId4VcVerificationSessionRecord>

export type DefaultOpenId4VcVerificationSessionRecordTags = {
  verifierId: string
  state: OpenId4VcVerificationSessionState
  nonce: string
  payloadState?: string
  authorizationRequestUri?: string
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
  authorizationRequestPayload?: OpenId4VcSiopAuthorizationRequestPayload

  authorizationResponsePayload?: OpenId4VcSiopAuthorizationResponsePayload

  /**
   * Presentation during issuance session. This is used when issuance of a credential requires a presentation, and helps
   * prevent session fixation attacks
   */
  presentationDuringIssuanceSession?: string
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
  public authorizationRequestPayload?: OpenId4VcSiopAuthorizationRequestPayload

  /**
   * URI of the authorization request. This is the url that can be used to
   * retrieve the authorization request.
   *
   * Not used for requests with response_mode of dc_api or dc_api.jwt
   */
  public authorizationRequestUri?: string

  /**
   * The payload of the received authorization response
   */
  public authorizationResponsePayload?: OpenId4VcSiopAuthorizationResponsePayload

  /**
   * Presentation during issuance session. This is used when issuance of a credential requires a presentation, and helps
   * prevent session fixation attacks
   */
  public presentationDuringIssuanceSession?: string

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
      this.authorizationResponsePayload = props.authorizationResponsePayload

      this.presentationDuringIssuanceSession = props.presentationDuringIssuanceSession
    }
  }

  public get request(): string | OpenId4VcSiopAuthorizationRequestPayload {
    if (this.authorizationRequestJwt) return this.authorizationRequestJwt
    if (this.authorizationRequestPayload) return this.authorizationRequestPayload

    throw new CredoError('Unable to extract authorization payload from openid4vc session record')
  }

  public get requestPayload(): OpenId4VcSiopAuthorizationRequestPayload {
    if (this.authorizationRequestJwt)
      return Jwt.fromSerializedJwt(
        this.authorizationRequestJwt
      ).payload.toJson() as OpenId4VcSiopAuthorizationRequestPayload
    if (this.authorizationRequestPayload) return this.authorizationRequestPayload

    throw new CredoError('Unable to extract authorization payload from openid4vc session record')
  }

  public assertState(expectedStates: OpenId4VcVerificationSessionState | OpenId4VcVerificationSessionState[]) {
    if (!Array.isArray(expectedStates)) {
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
    if (!nonce || typeof nonce !== 'string') throw new CredoError('Expected nonce in authorization request payload')

    const payloadState = 'state' in request ? (request.state as string) : undefined

    return {
      ...this._tags,
      verifierId: this.verifierId,
      state: this.state,
      nonce,
      payloadState,
      authorizationRequestUri: this.authorizationRequestUri,
    }
  }
}
