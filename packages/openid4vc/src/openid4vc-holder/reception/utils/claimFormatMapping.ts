import { AriesFrameworkError, ClaimFormat } from '@aries-framework/core'

export enum OpenId4VciCredentialFormatProfile {
  JwtVcJson = 'jwt_vc_json',
  JwtVcJsonLd = 'jwt_vc_json-ld',
  LdpVc = 'ldp_vc',
  SdJwtVc = 'vc+sd-jwt',
}

export const fromDifClaimFormatToOpenIdCredentialFormatProfile = (
  claimFormat: ClaimFormat
): OpenId4VciCredentialFormatProfile => {
  switch (claimFormat) {
    case ClaimFormat.JwtVc:
      return OpenId4VciCredentialFormatProfile.JwtVcJson
    case ClaimFormat.LdpVc:
      return OpenId4VciCredentialFormatProfile.LdpVc
    default:
      throw new AriesFrameworkError(
        `Unsupported DIF claim format, ${claimFormat}, to map to an openid credential format profile`
      )
  }
}

export const fromOpenIdCredentialFormatProfileToDifClaimFormat = (
  openidCredentialFormatProfile: OpenId4VciCredentialFormatProfile
): ClaimFormat => {
  switch (openidCredentialFormatProfile) {
    case OpenId4VciCredentialFormatProfile.JwtVcJson:
      return ClaimFormat.JwtVc
    case OpenId4VciCredentialFormatProfile.JwtVcJsonLd:
      return ClaimFormat.JwtVc
    case OpenId4VciCredentialFormatProfile.LdpVc:
      return ClaimFormat.LdpVc
    default:
      throw new AriesFrameworkError(
        `Unsupported openid credential format profile, ${openidCredentialFormatProfile}, to map to a DIF claim format`
      )
  }
}
