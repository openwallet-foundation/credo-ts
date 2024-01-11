import type { OpenId4VciCredentialSupportedWithId } from '../src'

import { OpenIdCredentialFormatProfile } from '../src'

export const openBadgeCredential: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/OpenBadgeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

export const universityDegreeCredential: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/UniversityDegreeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

export const universityDegreeCredentialLd: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/UniversityDegreeCredentialLd`,
  format: OpenIdCredentialFormatProfile.JwtVcJsonLd,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
  '@context': ['context'],
}

export const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential',
  cryptographic_binding_methods_supported: ['did:key'],
} satisfies OpenId4VciCredentialSupportedWithId

export const universityDegreeCredentialSdJwt2 = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt2',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential2',
  // FIXME: should this be dynamically generated? I think static is fine for now
  cryptographic_binding_methods_supported: ['jwk'],
} satisfies OpenId4VciCredentialSupportedWithId

export const allCredentialsSupported = [
  openBadgeCredential,
  universityDegreeCredential,
  universityDegreeCredentialLd,
  universityDegreeCredentialSdJwt,
  universityDegreeCredentialSdJwt2,
]
