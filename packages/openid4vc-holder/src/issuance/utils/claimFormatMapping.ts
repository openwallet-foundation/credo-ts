import { AriesFrameworkError, ClaimFormat } from '@aries-framework/core'

export enum OpenIdCredentialFormatProfile {
  JwtVcJson = 'jwt_vc_json',
  JwtVcJsonLd = 'jwt_vc_json-ld',
  LdpVc = 'ldp_vc',
  MsoMdoc = 'mso_mdoc',
}

export const fromDifClaimFormatToOpenIdCredentialFormatProfile = (
  claimFormat: ClaimFormat
): OpenIdCredentialFormatProfile => {
  switch (claimFormat) {
    case ClaimFormat.JwtVc:
      return OpenIdCredentialFormatProfile.JwtVcJson
    case ClaimFormat.LdpVc:
      return OpenIdCredentialFormatProfile.LdpVc
    default:
      throw new AriesFrameworkError(
        `Unsupported DIF claim format, ${claimFormat}, to map to an openid credential format profile`
      )
  }
}

export const fromOpenIdCredentialFormatProfileToDifClaimFormat = (
  openidCredentialFormatProfile: OpenIdCredentialFormatProfile
): ClaimFormat => {
  switch (openidCredentialFormatProfile) {
    case OpenIdCredentialFormatProfile.JwtVcJson:
      return ClaimFormat.JwtVc
    case OpenIdCredentialFormatProfile.JwtVcJsonLd:
      return ClaimFormat.JwtVc
    case OpenIdCredentialFormatProfile.LdpVc:
      return ClaimFormat.LdpVc
    default:
      throw new AriesFrameworkError(
        `Unsupported openid credential format profile, ${openidCredentialFormatProfile}, to map to a DIF claim format`
      )
  }
}
