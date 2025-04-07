import { Jwk } from './jose/jwk'

export interface JwsSignerDid {
  method: 'did'
  didUrl: string
}

export interface JwsSignerX5c {
  method: 'x5c'

  /**
   *
   * Array of base64-encoded certificate strings in the DER-format.
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   */
  x5c: string[]
}

export interface JwsSignerJwk {
  method: 'jwk'
  jwk: Jwk
}

export type JwsSigner = JwsSignerDid | JwsSignerX5c | JwsSignerJwk
export type JwsSignerWithJwk = JwsSigner & { jwk: Jwk }
