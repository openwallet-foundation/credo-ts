import type { PlaintextDidCommV1Message } from './versions/v1'
import type { PlaintextDidCommV2Message } from './versions/v2'
import type { Key } from '../crypto'

export enum EnvelopeType {
  Plain = 'plain',
  Signed = 'signed',
  Encrypted = 'encrypted',
}

export type PlaintextMessage = PlaintextDidCommV1Message | PlaintextDidCommV2Message

export type EncryptedMessageRecipientHeader = {
  kid: string
  epk?: string
}

export type EncryptedMessageRecipient = {
  encrypted_key: string
  header: EncryptedMessageRecipientHeader
}

export type EncryptedMessage = {
  /**
   * The "protected" member MUST be present and contain the value
   * BASE64URL(UTF8(JWE Protected Header)) when the JWE Protected
   * Header value is non-empty; otherwise, it MUST be absent.  These
   * Header Parameter values are integrity protected.
   */
  protected: string

  /**
   * The "iv" member MUST be present and contain the value
   * BASE64URL(JWE Initialization Vector) when the JWE Initialization
   * Vector value is non-empty; otherwise, it MUST be absent.
   */
  iv: string

  /**
   * The "ciphertext" member MUST be present and contain the value
   * BASE64URL(JWE Ciphertext).
   */
  ciphertext: string

  /**
   * The "tag" member MUST be present and contain the value
   * BASE64URL(JWE Authentication Tag) when the JWE Authentication Tag
   * value is non-empty; otherwise, it MUST be absent.
   */
  tag: string

  recipients: EncryptedMessageRecipient[]
}

export type SignatureHeader = {
  kid: string
}

export type Signature = {
  header: SignatureHeader
  protected: string
  signature: string
}

export type SignedMessage = {
  signatures: Array<Signature>
  payload: string
}

export type ProtectedMessage = {
  typ: string
  alg: string
}

export enum DidCommMessageVersion {
  V1 = 'DIDCommV1',
  V2 = 'DIDCommV2',
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: Key
  recipientKey?: Key
  didCommVersion?: DidCommMessageVersion
}

export type OutboundPackagePayload = EncryptedMessage | SignedMessage | PlaintextMessage

export interface OutboundPackage {
  payload: OutboundPackagePayload
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
}
