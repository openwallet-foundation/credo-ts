import { Kms } from '@credo-ts/core'
import type { OpenId4VciCredentialConfigurationSupportedWithFormats } from '../src'

import { OpenId4VciCredentialFormatProfile } from '../src'

export const openBadgeCredential = {
  id: '/credentials/OpenBadgeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  credential_definition: {
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
  },
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredential = {
  id: '/credentials/UniversityDegreeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  credential_definition: {
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
  },
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialLd = {
  id: '/credentials/UniversityDegreeCredentialLd',
  format: OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  credential_definition: {
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    '@context': ['context'],
  },
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential',
  cryptographic_binding_methods_supported: ['did:key'],
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialConfigurationSupported = {
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  scope: 'UniversityDegreeCredential',
  vct: 'UniversityDegreeCredential',
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
  cryptographic_binding_methods_supported: ['did:key', 'jwk'],
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialConfigurationSupportedJwkOnly = {
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  scope: 'UniversityDegreeCredential',
  vct: 'UniversityDegreeCredential',
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
  cryptographic_binding_methods_supported: ['jwk'],
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialConfigurationSupportedMdoc = {
  format: OpenId4VciCredentialFormatProfile.MsoMdoc,
  scope: 'UniversityDegreeCredential',
  doctype: 'UniversityDegreeCredential',
  proof_types_supported: {
    jwt: { proof_signing_alg_values_supported: ['ES256', 'EdDSA'] },
  },
  cryptographic_binding_methods_supported: ['jwk'],
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

export const universityDegreeCredentialSdJwt2 = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt2',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential2',
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: [
        Kms.KnownJwaSignatureAlgorithms.EdDSA,
        Kms.KnownJwaSignatureAlgorithms.ES256,
      ],
    },
  },
  // FIXME: should this be dynamically generated? I think static is fine for now
  cryptographic_binding_methods_supported: ['jwk'],
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats
