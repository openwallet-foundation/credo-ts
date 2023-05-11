import type { JwaSignatureAlgorithm } from './jose/jwa'
import type { Jwk } from './jose/jwk'
import type { JwkJson } from './jose/jwk/Jwk'

export type Kid = string

export interface JwsProtectedHeaderOptions {
  alg: JwaSignatureAlgorithm | string
  kid?: Kid
  jwk?: Jwk
  [key: string]: unknown
}

export interface JwsProtectedHeader {
  alg: JwaSignatureAlgorithm | string
  kid?: Kid
  jwk?: JwkJson
  [key: string]: unknown
}

export interface JwsGeneralFormat {
  header: Record<string, unknown>
  signature: string
  protected: string
}

export interface JwsFlattenedFormat {
  signatures: JwsGeneralFormat[]
}

export type Jws = JwsGeneralFormat | JwsFlattenedFormat
