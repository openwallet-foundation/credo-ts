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

export interface OpenId4VcIssuerX5c {
  method: 'x5c'

  /**
   * Array of X.509 certificates
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   * The first certificate MUST also have a key id configured on the public key to enable signing with the KMS.
   */
  x5c: X509Certificate[]

  /**
   * The issuer of the JWT. Should be a HTTPS URI.
   *
   * The issuer value must either match a `uniformResourceIdentifier` SAN entry of the leaf entity certificate
   * or the domain name in the `iss` value matches a `dNSName` SAN entry of the leaf-entity certificate.
   */
  issuer: string
}

export interface OpenId4VcJwtIssuerJwk {
  method: 'jwk'
  jwk: Kms.PublicJwk
}

export type OpenId4VcJwtIssuer = OpenId4VcJwtIssuerDid | OpenId4VcIssuerX5c | OpenId4VcJwtIssuerJwk
