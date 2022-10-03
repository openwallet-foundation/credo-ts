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

export interface PlaintextMessage {
  '@type'?: string
  '@id'?: string
  type?: string
  id?: string

  [key: string]: unknown
}

export type ReceivedPlainMessage = {
  type: SendingMessageType.Plain
  message: PlaintextMessage
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

export enum DIDCommVersion {
  V1 = 'DIDCommV1',
  V2 = 'DIDCommV2',
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
