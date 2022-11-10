import type { Key } from '../../crypto'

export enum MessageType {
  Plain = 'plain',
  Signed = 'signed',
  Encrypted = 'encrypted',
}

export type ReceivedMessage = ReceivedEncryptedMessage | ReceivedSignedMessage | ReceivedPlainMessage

export type ReceivedEncryptedMessage = {
  type: MessageType.Encrypted
  message: EncryptedMessage
}

export type ReceivedSignedMessage = {
  type: MessageType.Signed
  message: SignedMessage
}

export type ReceivedPlainMessage = {
  type: MessageType.Plain
  message: PlaintextMessage
}

export type PlaintextMessage = PlaintextDIDCommV1Message | PlaintextDIDCommV2Message

export interface PlaintextDIDCommV1Message {
  '@type': string
  '@id': string
  [key: string]: unknown
}

export interface PlaintextDIDCommV2Message {
  type: string
  id: string
  [key: string]: unknown
}

export type EncryptedMessageRecipientHeader = {
  kid: string
}

export type EncryptedMessageRecipient = {
  encrypted_key: string
  header: EncryptedMessageRecipientHeader
}

export type EncryptedMessage = {
  protected: string
  iv: string
  ciphertext: string
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

export enum DIDCommMessageVersion {
  V1 = 'DIDCommV1',
  V2 = 'DIDCommV2',
}

export enum DidCommV1Types {
  JwmV1 = 'JWM/1.0',
}

export enum DidCommV1Algorithms {
  Authcrypt = 'Authcrypt',
  Anoncrypt = 'Anoncrypt',
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: Key
  recipientKey?: Key
  version?: DIDCommMessageVersion
}
