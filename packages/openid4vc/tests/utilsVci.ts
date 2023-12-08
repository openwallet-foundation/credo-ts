import type { CredentialSupported } from '@sphereon/oid4vci-common'

import { OpenIdCredentialFormatProfile } from '../src'

export const openBadgeCredential: CredentialSupported & { id: string } = {
  id: `/credentials/OpenBadgeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

export const universityDegreeCredential: CredentialSupported & { id: string } = {
  id: `/credentials/UniversityDegreeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

export const universityDegreeCredentialLd: CredentialSupported & { id: string } = {
  id: `/credentials/UniversityDegreeCredentialLd`,
  format: OpenIdCredentialFormatProfile.JwtVcJsonLd,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
  '@context': ['context'],
}

export const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    vct: 'UniversityDegreeCredential',
  },
} satisfies CredentialSupported & { id: string }

export const universityDegreeCredentialSdJwt2 = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt2',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    vct: 'UniversityDegreeCredential2',
  },
} satisfies CredentialSupported & { id: string }

export const allCredentialsSupported = [
  openBadgeCredential,
  universityDegreeCredential,
  universityDegreeCredentialLd,
  universityDegreeCredentialSdJwt,
  universityDegreeCredentialSdJwt2,
]
