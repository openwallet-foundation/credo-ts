import type { Jwk } from '@credo-ts/core'

interface OpenId4VcJwtIssuerDid {
  method: 'did'
  didUrl: string
}

interface OpenId4VcIssuerX5c {
  method: 'x5c'

  /**
   *
   * Array of base64-encoded certificate strings in the DER-format.
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   */
  chain: string[]

  /**
   * The issuer of the JWT.
   *
   * If the issuer is a DNS name the x509_san_dns client_id_scheme is used
   * Otherwise the x509_san_uri client_id_scheme is used.
   *
   * Must be provided when creating x509 certificate protected authorization requests.
   */
  issuer: string
}

interface OpenId4VcJwtIssuerJwk {
  method: 'jwk'
  jwk: Jwk
}

export type OpenId4VcJwtIssuer = OpenId4VcJwtIssuerDid | OpenId4VcIssuerX5c | OpenId4VcJwtIssuerJwk
