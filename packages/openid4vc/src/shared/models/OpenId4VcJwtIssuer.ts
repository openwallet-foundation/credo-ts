interface OpenId4VcJwtIssuerDid {
  method: 'did'
  didUrl: string
}

// TODO: enable once supported in sphereon lib
// See https://github.com/Sphereon-Opensource/SIOP-OID4VP/issues/67
// interface OpenId4VcJwtIssuerJwk {
//   method: 'jwk'
//   jwk: Jwk
// }

export type OpenId4VcJwtIssuer = OpenId4VcJwtIssuerDid
