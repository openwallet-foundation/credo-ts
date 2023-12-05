import { AriesFrameworkError, ClaimFormat } from '@aries-framework/core'

import {
  fromDifClaimFormatToOpenIdCredentialFormatProfile,
  fromOpenIdCredentialFormatProfileToDifClaimFormat,
  OpenIdCredentialFormatProfile,
} from '../claimFormatMapping'

describe('claimFormatMapping', () => {
  it('should convert from openid credential format profile to DIF claim format', () => {
    expect(fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.LdpVc)).toStrictEqual(
      OpenIdCredentialFormatProfile.LdpVc
    )

    expect(fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.JwtVc)).toStrictEqual(
      OpenIdCredentialFormatProfile.JwtVcJson
    )

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.Jwt)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.Ldp)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.JwtVp)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.LdpVp)).toThrow(AriesFrameworkError)
  })

  it('should convert from DIF claim format to openid credential format profile', () => {
    expect(fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenIdCredentialFormatProfile.JwtVcJson)).toStrictEqual(
      ClaimFormat.JwtVc
    )

    expect(fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenIdCredentialFormatProfile.JwtVcJsonLd)).toStrictEqual(
      ClaimFormat.JwtVc
    )

    expect(fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenIdCredentialFormatProfile.LdpVc)).toStrictEqual(
      ClaimFormat.LdpVc
    )
  })
})
