import { Kms, X509Certificate } from '@credo-ts/core'

export interface TokenStatusListSignerDid {
  method: 'did'

  /**
   * The did url pointing to a specific verification method.
   *
   * Note a created DID record MUST exist for the did url, enabling extraction of the KMS key id from the did record.
   */
  didUrl: string
}

export interface TokenStatusListSignerX5c {
  method: 'x5c'

  /**
   * Array of X.509 certificates
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   * The first certificate MUST also have a key id configured on the public key to enable signing with the KMS.
   */
  x5c: X509Certificate[]
}

export interface TokenStatusListSignerJwk {
  method: 'jwk'
  jwk: Kms.PublicJwk
}

export interface OpenId4VcJwtIssuerJwkEncoded {
  method: 'jwk'
  jwk: Kms.KmsJwkPublic
}

export type TokenStatusListSigner = TokenStatusListSignerDid | TokenStatusListSignerX5c | TokenStatusListSignerJwk
