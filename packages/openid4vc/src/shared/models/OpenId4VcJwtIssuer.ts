import { Kms, X509Certificate } from '@credo-ts/core'

export interface OpenId4VcJwtIssuerDid {
  method: 'did'

  /**
   * The did url pointing to a specific verification method.
   *
   * Note a created DID record MUST exist for the did url, enabling extraction of the KMS key id from the did record.
   */
  didUrl: string
}

export interface OpenId4VcJwtIssuerX5c {
  method: 'x5c'

  /**
   * Array of X.509 certificates
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   * The first certificate MUST also have a key id configured on the public key to enable signing with the KMS.
   */
  x5c: X509Certificate[]
}

export interface OpenId4VcJwtIssuerX5cEncoded {
  method: 'x5c'

  /**
   * x5c encoded as base64
   */
  x5c: string[]

  /**
   * key id associated with the leaf certificate
   */
  leafCertificateKeyId: string
}

export interface OpenId4VcJwtIssuerJwk {
  method: 'jwk'
  jwk: Kms.PublicJwk
}

export interface OpenId4VcJwtIssuerJwkEncoded {
  method: 'jwk'
  jwk: Kms.KmsJwkPublic
}

export type OpenId4VcJwtIssuer = OpenId4VcJwtIssuerDid | OpenId4VcJwtIssuerX5c | OpenId4VcJwtIssuerJwk
export type OpenId4VcJwtIssuerEncoded =
  | OpenId4VcJwtIssuerDid
  | OpenId4VcJwtIssuerX5cEncoded
  | OpenId4VcJwtIssuerJwkEncoded
