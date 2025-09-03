/**
 * Defines the claim format based on the formats registered in
 * [DIF Claim Format Registry](https://identity.foundation/claim-format-registry/).
 */
export enum ClaimFormat {
  Jwt = 'jwt',
  JwtVc = 'jwt_vc',
  JwtVp = 'jwt_vp',
  Ldp = 'ldp',
  LdpVc = 'ldp_vc',
  LdpVp = 'ldp_vp',
  Di = 'di',
  DiVc = 'di_vc',
  DiVp = 'di_vp',
  SdJwtDc = 'dc+sd-jwt',
  JwtW3cVc = 'vc+jwt',
  JwtW3cVp = 'vp+jwt',
  SdJwtW3cVc = 'vc+sd-jwt',
  SdJwtW3cVp = 'vp+sd-jwt',
  MsoMdoc = 'mso_mdoc',
}
