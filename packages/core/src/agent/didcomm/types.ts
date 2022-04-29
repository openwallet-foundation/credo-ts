import type { PlaintextMessage } from './EnvelopeService'

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
