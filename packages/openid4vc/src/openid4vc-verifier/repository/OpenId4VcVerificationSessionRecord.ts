import type { OpenId4VcSiopAuthorizationResponsePayload } from '../../shared/models'
import type { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { Jwt, CredoError, BaseRecord, utils } from '@credo-ts/core'

export type OpenId4VcVerificationSessionRecordTags = RecordTags<OpenId4VcVerificationSessionRecord>

export type DefaultOpenId4VcVerificationSessionRecordTags = {
  verifierId: string
  state: OpenId4VcVerificationSessionState
  nonce: string
  payloadState: string
  authorizationRequestUri: string
}

export interface OpenId4VcVerificationSessionRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  verifierId: string
  state: OpenId4VcVerificationSessionState
  errorMessage?: string

  authorizationRequestUri: string
  authorizationRequestJwt: string

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
  public authorizationRequestJwt!: string

  /**
   * URI of the authorization request. This is the url that can be used to
   * retrieve the authorization request
   */
  public authorizationRequestUri!: string

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
      this.authorizationRequestJwt = props.authorizationRequestJwt
      this.authorizationRequestUri = props.authorizationRequestUri
      this.authorizationResponsePayload = props.authorizationResponsePayload

      this.presentationDuringIssuanceSession = props.presentationDuringIssuanceSession
    }
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
    const parsedAuthorizationRequest = Jwt.fromSerializedJwt(this.authorizationRequestJwt)

    const nonce = parsedAuthorizationRequest.payload.additionalClaims.nonce
    if (!nonce || typeof nonce !== 'string') throw new CredoError('Expected nonce in authorization request payload')

    const payloadState = parsedAuthorizationRequest.payload.additionalClaims.state
    if (!payloadState || typeof payloadState !== 'string')
      throw new CredoError('Expected state in authorization request payload')

    return {
      ...this._tags,
      verifierId: this.verifierId,
      state: this.state,
      nonce,
      // FIXME: how do we call this property so it doesn't conflict with the record state?
      payloadState,
      authorizationRequestUri: this.authorizationRequestUri,
    }
  }
}
