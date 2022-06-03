import type { DIDCommVersion } from './DIDCommMessage'
import type { PlaintextMessage } from './EnvelopeService'
import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

export enum SendingMessageType {
  Plain = 'plain',
  Signed = 'signed',
  Encrypted = 'encrypted',
}

export type PackedMessage = ReceivedEncryptedMessage | ReceivedSignedMessage | ReceivedPlainMessage

export type ReceivedEncryptedMessage = {
  type: SendingMessageType.Encrypted
  message: EncryptedMessage
}

export type ReceivedSignedMessage = {
  type: SendingMessageType.Signed
  message: SignedMessage
}

export type ReceivedPlainMessage = {
  type: SendingMessageType.Plain
  message: PlaintextMessage
}

export type EncryptedMessage = {
  protected: string
  iv: string
  ciphertext: string
  tag: string
}

export type SignedMessage = {
  signatures: Array<Signature>
  payload: string
}

export type SignatureHeader = {
  kid: string
}

export type Signature = {
  header: SignatureHeader
  protected: string
  signature: string
}

export type ProtectedMessage = {
  typ: string
  alg: string
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  sender?: string
  recipient?: string
  version?: DIDCommVersion
}

export enum DidCommV1Types {
  JwmV1 = 'JWM/1.0',
}

export enum DidCommV1Algorithms {
  Authcrypt = 'Authcrypt',
  Anoncrypt = 'Anoncrypt',
}

export type DIDCommMessageClass = typeof DIDCommV1Message | typeof DIDCommV2Message
