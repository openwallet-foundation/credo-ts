import { AriesFrameworkError, ClaimFormat } from '@aries-framework/core'

import {
  fromDifClaimFormatToOpenIdCredentialFormatProfile,
  fromOpenIdCredentialFormatProfileToDifClaimFormat,
  OpenId4VciCredentialFormatProfile,
} from '../claimFormatMapping'

describe('claimFormatMapping', () => {
  it('should convert from openid credential format profile to DIF claim format', () => {
    expect(fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.LdpVc)).toStrictEqual(
      OpenId4VciCredentialFormatProfile.LdpVc
    )

    expect(fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.JwtVc)).toStrictEqual(
      OpenId4VciCredentialFormatProfile.JwtVcJson
    )

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.Jwt)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.Ldp)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.JwtVp)).toThrow(AriesFrameworkError)

    expect(() => fromDifClaimFormatToOpenIdCredentialFormatProfile(ClaimFormat.LdpVp)).toThrow(AriesFrameworkError)
  })

  it('should convert from DIF claim format to openid credential format profile', () => {
    expect(
      fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenId4VciCredentialFormatProfile.JwtVcJson)
    ).toStrictEqual(ClaimFormat.JwtVc)

    expect(
      fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenId4VciCredentialFormatProfile.JwtVcJsonLd)
    ).toStrictEqual(ClaimFormat.JwtVc)

    expect(fromOpenIdCredentialFormatProfileToDifClaimFormat(OpenId4VciCredentialFormatProfile.LdpVc)).toStrictEqual(
      ClaimFormat.LdpVc
    )
  })
})
