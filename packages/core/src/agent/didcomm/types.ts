import type { PlaintextMessage } from './EnvelopeService'
import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

export type EncryptedMessage = {
  protected: string
  iv: string
  ciphertext: string
  tag: string
}

export type ProtectedMessage = {
  typ: string
  alg: string
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  sender?: string
  recipient?: string
}

export enum DidCommV1Types {
  JwmV1 = 'JWM/1.0',
}

export enum DidCommV1Algorithms {
  Authcrypt = 'Authcrypt',
  Anoncrypt = 'Anoncrypt',
}

export type DIDCommMessageInstance = typeof DIDCommV1Message | typeof DIDCommV2Message
