export interface PlaintextDidCommV1Message {
  '@type': string
  '@id': string

  [key: string]: unknown
}

export enum DidCommV1Types {
  JwmV1 = 'JWM/1.0',
}

export enum DidCommV1Algorithms {
  Authcrypt = 'Authcrypt',
  Anoncrypt = 'Anoncrypt',
}
