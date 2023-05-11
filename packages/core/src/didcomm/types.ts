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
