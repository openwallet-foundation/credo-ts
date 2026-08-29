import { CredoError } from '../../../error'
import { BaseRecord, type TagsBase } from '../../../storage/BaseRecord'
import { DateTransformer, JsonTransformer } from '../../../utils'
import type { Constructable } from '../../../utils/mixins'
import { uuid } from '../../../utils/uuid'
import type { MdocVerificationSessionState } from '../MdocVerificationSessionState'

/**
 * Session transcript of an ISO/IEC TS 18013-7:2025 Annex C (`org-iso-mdoc`) DC API session.
 *
 *   DCAPIHandover = [ "dcapi", SHA-256(CBOR([encryptionInfoBase64Url, origin])) ]
 */
export type MdocIsoDcApiVerificationSessionTranscript = {
  type: 'isoMdocDcApi'

  /**
   * Base64url encoded `EncryptionInfo` as sent to the wallet. The exact string matters: the
   * handover hashes this text, not the CBOR it encodes.
   */
  encryptionInfoBase64Url: string

  /**
   * Base64url encoded nonce contained in the `EncryptionInfo`. Contained in
   * `encryptionInfoBase64Url` as well, and kept here only so a session can be found by the nonce
   * of the request it was created for.
   */
  nonce: string

  /**
   * The origin the response was verified against, hashed into the handover together with the
   * `encryptionInfoBase64Url`. Only known once a response has been verified: the origin is carried
   * neither in the request nor in the response, so it has to be supplied by the verifier.
   */
  origin?: string
}

/**
 * The protocol-specific state of a verification session: what it takes to reconstruct the session
 * transcript the device response is bound to.
 *
 * This is the only part of a verification session that differs per mdoc protocol, so a new protocol
 * is added by extending this union rather than by widening the record.
 */
export type MdocVerificationSessionTranscript = MdocIsoDcApiVerificationSessionTranscript

export type DefaultMdocVerificationSessionRecordTags = {
  state: MdocVerificationSessionState

  /**
   * The mdoc protocol the session uses, from {@link MdocVerificationSessionRecord.sessionTranscript}.
   */
  sessionTranscriptType: MdocVerificationSessionTranscript['type']

  /**
   * Base64url encoded nonce of the request, for the protocols that have one. The Annex C response
   * carries no session identifier, so this is an index on the request side only — it cannot be used
   * to correlate a received response to its session.
   */
  nonce?: string
}

export interface MdocVerificationSessionRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  state: MdocVerificationSessionState
  errorMessage?: string

  deviceRequestBase64Url: string
  sessionTranscript: MdocVerificationSessionTranscript

  sessionKeyId: string
  expiresAt: Date
}

/**
 * A verification session for an mdoc presentation, currently the ISO/IEC TS 18013-7:2025 Annex C
 * (`org-iso-mdoc`) DC API.
 *
 * The device response is never persisted. It contains the disclosed claims, and the caller already
 * has it — for the DC API the exchange is synchronous, so the response is returned to the caller
 * rather than delivered out of band.
 */
export class MdocVerificationSessionRecord extends BaseRecord<DefaultMdocVerificationSessionRecordTags> {
  public static readonly type = 'MdocVerificationSessionRecord'
  public readonly type = MdocVerificationSessionRecord.type

  public state!: MdocVerificationSessionState

  /**
   * Error message of the error that occurred, set when state is {@link MdocVerificationSessionState.Error}.
   */
  public errorMessage?: string

  /**
   * Base64url encoded `DeviceRequest` as sent to the wallet.
   *
   * Only bound to the device response when the request was created with reader authentication.
   * Without reader auth the `DeviceRequest` is not covered by the session transcript, so it is a
   * record of what this agent asked for, not cryptographic evidence of it.
   */
  public deviceRequestBase64Url!: string

  /**
   * The protocol-specific state needed to reconstruct the session transcript, and the protocol the
   * session uses.
   */
  public sessionTranscript!: MdocVerificationSessionTranscript

  /**
   * Key id of the ephemeral key this agent created for the session. For the DC API this is the
   * recipient key the device response is encrypted to.
   *
   * The key outlives the session: it is deleted when the session record is deleted, so a session
   * can be inspected and its response re-processed for as long as the record is kept.
   */
  public sessionKeyId!: string

  @DateTransformer()
  public expiresAt!: Date

  public constructor(props: MdocVerificationSessionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}

      this.state = props.state
      this.errorMessage = props.errorMessage
      this.deviceRequestBase64Url = props.deviceRequestBase64Url
      this.sessionTranscript = props.sessionTranscript
      this.sessionKeyId = props.sessionKeyId
      this.expiresAt = props.expiresAt
    }
  }

  /**
   * The session transcript, asserted to be of a specific protocol.
   */
  public getSessionTranscript<Type extends MdocVerificationSessionTranscript['type']>(
    type: Type
  ): Extract<MdocVerificationSessionTranscript, { type: Type }> {
    if (this.sessionTranscript.type !== type) {
      throw new CredoError(
        `MdocVerificationSessionRecord uses mdoc protocol ${this.sessionTranscript.type}, but ${type} was expected.`
      )
    }

    return this.sessionTranscript as Extract<MdocVerificationSessionTranscript, { type: Type }>
  }

  public assertState(expectedStates: MdocVerificationSessionState | MdocVerificationSessionState[]) {
    const states = Array.isArray(expectedStates) ? expectedStates : [expectedStates]

    if (!states.includes(this.state)) {
      throw new CredoError(
        `MdocVerificationSessionRecord is in invalid state ${this.state}. Valid states are: ${states.join(', ')}.`
      )
    }
  }

  public get isExpired() {
    return this.expiresAt.getTime() < Date.now()
  }

  public getTags() {
    return {
      ...this._tags,
      state: this.state,
      sessionTranscriptType: this.sessionTranscript.type,
      nonce: this.sessionTranscript.nonce,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
