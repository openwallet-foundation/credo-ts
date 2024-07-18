import type { OpenId4VciCredentialConfigurationSupported, OpenId4VciCredentialSupportedWithId } from '../src'

import { OpenId4VciCredentialFormatProfile } from '../src'

export const openBadgeCredential: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/OpenBadgeCredential`,
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

export const universityDegreeCredential: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/UniversityDegreeCredential`,
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

export const universityDegreeCredentialLd: OpenId4VciCredentialSupportedWithId = {
  id: `/credentials/UniversityDegreeCredentialLd`,
  format: OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
  '@context': ['context'],
}

export const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential',
  cryptographic_binding_methods_supported: ['did:key'],
} satisfies OpenId4VciCredentialSupportedWithId

export const universityDegreeCredentialConfigurationSupported = {
  credential_definition: {},
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  scope: 'UniversityDegreeCredential',
  vct: 'UniversityDegreeCredential',
  proof_types_supported: {
    jwt: { proof_signing_alg_values_supported: ['EdDSA'] },
    cwt: { proof_signing_alg_values_supported: [] },
    ldp_vp: { proof_signing_alg_values_supported: [] },
  },
  cryptographic_binding_methods_supported: ['did:key'],
} satisfies OpenId4VciCredentialConfigurationSupported

export const universityDegreeCredentialSdJwt2 = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt2',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
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
