import { W3cV2DataIntegrityVerifiableCredential } from '../data-integrity-v1'
import { W3cV2JwtVerifiablePresentation } from '../jwt-vc'
import { W3cV2EnvelopedVerifiableCredential } from '../models/credential/W3cV2EnvelopedVerifiableCredential'
import { W3cV2EnvelopedVerifiablePresentation } from '../models/presentation/W3cV2EnvelopedVerifiablePresentation'
import { W3cV2Presentation } from '../models/presentation/W3cV2Presentation'
import { W3cV2SdJwtVerifiablePresentation } from '../sd-jwt-vc'

// Inner mixed credentials (jwt, sd-jwt, data integrity)
export const mixedVpBaseResolvedPresentation = {
  __proto__: W3cV2Presentation.prototype,
  id: 'urn:21ff21f1-3cf9-4fa3-88b4-a045efbb1b5f',
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiablePresentation'],
  holder: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
  nonce: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
  verifiableCredential: [
    {
      __proto__: W3cV2EnvelopedVerifiableCredential.prototype,
      '@context': 'https://www.w3.org/ns/credentials/v2',
      id: 'data:application/vc+jwt,eyJ0eXAiOiJ2Yytqd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZUNJNklucFJUMjkzU1VNeFoxZEtkR1JrWkVJMVIwRjBOR3hoZFRaTWREaEphSGszTnpGcFFXWmhiUzB4Y0dNaUxDSjVJam9pWTJwRVh6ZHZNMmRrVVRGMloybFJlVE5mYzAxSGN6ZFhjbmREVFZVNVJsRlphVzFCTTBoNGJrMXNkeUo5IzAifQ.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3B1cmwuaW1zZ2xvYmFsLm9yZy9zcGVjL29iL3YzcDAvY29udGV4dC5qc29uIl0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlQ3JlZGVudGlhbEV4dGVuc2lvbiIsIk9wZW5CYWRnZUNyZWRlbnRpYWwiXSwiaXNzdWVyIjp7ImlkIjoiZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2llQ0k2SW5wUlQyOTNTVU14WjFkS2RHUmtaRUkxUjBGME5HeGhkVFpNZERoSmFIazNOekZwUVdaaGJTMHhjR01pTENKNUlqb2lZMnBFWHpkdk0yZGtVVEYyWjJsUmVUTmZjMDFIY3pkWGNuZERUVlU1UmxGWmFXMUJNMGg0Ymsxc2R5SjkiLCJuYW1lIjoiSm9icyBmb3IgdGhlIEZ1dHVyZSAoSkZGKSIsImljb25VcmwiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIiwiaW1hZ2UiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIn0sIm5hbWUiOiJKRkYgeCB2Yy1lZHUgUGx1Z0Zlc3QgMiIsImRlc2NyaXB0aW9uIjoiTUFUVFIncyBzdWJtaXNzaW9uIGZvciBKRkYgUGx1Z2Zlc3QgMiIsImNyZWRlbnRpYWxCcmFuZGluZyI6eyJiYWNrZ3JvdW5kQ29sb3IiOiIjNDY0YzQ5In0sInZhbGlkRnJvbSI6IjIwMjMtMDEtMjVUMTY6NTg6MDYuMjkyWiIsImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJ0eXBlIjpbIkFjaGlldmVtZW50U3ViamVjdCJdLCJhY2hpZXZlbWVudCI6eyJpZCI6InVybjp1dWlkOmJkNmQ5MzE2LWY3YWUtNDA3My1hMWU1LTJmN2Y1YmQyMjkyMiIsIm5hbWUiOiJKRkYgeCB2Yy1lZHUgUGx1Z0Zlc3QgMiBJbnRlcm9wZXJhYmlsaXR5IiwidHlwZSI6WyJBY2hpZXZlbWVudCJdLCJpbWFnZSI6eyJpZCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMi0yMDIyL2ltYWdlcy9KRkYtVkMtRURVLVBMVUdGRVNUMi1iYWRnZS1pbWFnZS5wbmciLCJ0eXBlIjoiSW1hZ2UifSwiY3JpdGVyaWEiOnsidHlwZSI6IkNyaXRlcmlhIiwibmFycmF0aXZlIjoiU29sdXRpb25zIHByb3ZpZGVycyBlYXJuZWQgdGhpcyBiYWRnZSBieSBkZW1vbnN0cmF0aW5nIGludGVyb3BlcmFiaWxpdHkgYmV0d2VlbiBtdWx0aXBsZSBwcm92aWRlcnMgYmFzZWQgb24gdGhlIE9CdjMgY2FuZGlkYXRlIGZpbmFsIHN0YW5kYXJkLCB3aXRoIHNvbWUgYWRkaXRpb25hbCByZXF1aXJlZCBmaWVsZHMuIENyZWRlbnRpYWwgaXNzdWVycyBlYXJuaW5nIHRoaXMgYmFkZ2Ugc3VjY2Vzc2Z1bGx5IGlzc3VlZCBhIGNyZWRlbnRpYWwgaW50byBhdCBsZWFzdCB0d28gd2FsbGV0cy4gIFdhbGxldCBpbXBsZW1lbnRlcnMgZWFybmluZyB0aGlzIGJhZGdlIHN1Y2Nlc3NmdWxseSBkaXNwbGF5ZWQgY3JlZGVudGlhbHMgaXNzdWVkIGJ5IGF0IGxlYXN0IHR3byBkaWZmZXJlbnQgY3JlZGVudGlhbCBpc3N1ZXJzLiJ9LCJkZXNjcmlwdGlvbiI6IlRoaXMgY3JlZGVudGlhbCBzb2x1dGlvbiBzdXBwb3J0cyB0aGUgdXNlIG9mIE9CdjMgYW5kIHczYyBWZXJpZmlhYmxlIENyZWRlbnRpYWxzIGFuZCBpcyBpbnRlcm9wZXJhYmxlIHdpdGggYXQgbGVhc3QgdHdvIG90aGVyIHNvbHV0aW9ucy4gIFRoaXMgd2FzIGRlbW9uc3RyYXRlZCBzdWNjZXNzZnVsbHkgZHVyaW5nIEpGRiB4IHZjLWVkdSBQbHVnRmVzdCAyLiJ9fSwiY25mIjp7ImtpZCI6ImRpZDprZXk6ejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2I3o2TWtxZ2tMclJ5TGc2YnFrMjdkandiYmFRV2dhU1lnRlZDS3E5WUt4WmJOa3BWdiJ9LCJpYXQiOjE2OTgxNTE1MzJ9.nGTrQ3gpIKtNJaOUusMYV2ITzN5FMdgu2XSKNu1t-Bxc2uXbnUbP4fkULmGddakfODCA2Cuzz2PkL2QqgwOdyA',
      type: 'EnvelopedVerifiableCredential',
    },
    {
      __proto__: W3cV2EnvelopedVerifiableCredential.prototype,
      '@context': 'https://www.w3.org/ns/credentials/v2',
      id: 'data:application/vc+sd-jwt,eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZUNJNklucFJUMjkzU1VNeFoxZEtkR1JrWkVJMVIwRjBOR3hoZFRaTWREaEphSGszTnpGcFFXWmhiUzB4Y0dNaUxDSjVJam9pWTJwRVh6ZHZNMmRrVVRGMloybFJlVE5mYzAxSGN6ZFhjbmREVFZVNVJsRlphVzFCTTBoNGJrMXNkeUo5IzAifQ.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3B1cmwuaW1zZ2xvYmFsLm9yZy9zcGVjL29iL3YzcDAvY29udGV4dC5qc29uIl0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlQ3JlZGVudGlhbEV4dGVuc2lvbiIsIk9wZW5CYWRnZUNyZWRlbnRpYWwiXSwiaXNzdWVyIjp7ImlkIjoiZGlkOmp3azpleUpyZEhraU9pSkZReUlzSW1OeWRpSTZJbEF0TWpVMklpd2llQ0k2SW5wUlQyOTNTVU14WjFkS2RHUmtaRUkxUjBGME5HeGhkVFpNZERoSmFIazNOekZwUVdaaGJTMHhjR01pTENKNUlqb2lZMnBFWHpkdk0yZGtVVEYyWjJsUmVUTmZjMDFIY3pkWGNuZERUVlU1UmxGWmFXMUJNMGg0Ymsxc2R5SjkiLCJuYW1lIjoiSm9icyBmb3IgdGhlIEZ1dHVyZSAoSkZGKSIsImljb25VcmwiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIiwiaW1hZ2UiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIn0sIm5hbWUiOiJKRkYgeCB2Yy1lZHUgUGx1Z0Zlc3QgMiIsImRlc2NyaXB0aW9uIjoiTUFUVFIncyBzdWJtaXNzaW9uIGZvciBKRkYgUGx1Z2Zlc3QgMiIsImNyZWRlbnRpYWxCcmFuZGluZyI6eyJiYWNrZ3JvdW5kQ29sb3IiOiIjNDY0YzQ5In0sInZhbGlkRnJvbSI6IjIwMjMtMDEtMjVUMTY6NTg6MDYuMjkyWiIsImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJ0eXBlIjpbIkFjaGlldmVtZW50U3ViamVjdCJdLCJfc2QiOlsiZ0RGVzg2SGNNSDJxS2t6QWZxTEM4LWRaMm9WOUFFWlBWQ211NlA0cThjYyJdfSwiaWF0IjoxNjk4MTUxNTMyLCJjbmYiOnsia2lkIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYjejZNa3Fna0xyUnlMZzZicWsyN2Rqd2JiYVFXZ2FTWWdGVkNLcTlZS3haYk5rcFZ2In0sIl9zZF9hbGciOiJzaGEtMjU2In0.WQXjJmDyd5LpcgNAQJdycjyk1xIUJ7n184CU-V-MrhpgvmzYRrdUp1sVc4hjpebZN5jMYpvBWdSYwcavh5TfXg~WyJjMkZzZEEiLCJhY2hpZXZlbWVudCIseyJpZCI6InVybjp1dWlkOmJkNmQ5MzE2LWY3YWUtNDA3My1hMWU1LTJmN2Y1YmQyMjkyMiIsIm5hbWUiOiJKRkYgeCB2Yy1lZHUgUGx1Z0Zlc3QgMiBJbnRlcm9wZXJhYmlsaXR5IiwidHlwZSI6WyJBY2hpZXZlbWVudCJdLCJpbWFnZSI6eyJpZCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMi0yMDIyL2ltYWdlcy9KRkYtVkMtRURVLVBMVUdGRVNUMi1iYWRnZS1pbWFnZS5wbmciLCJ0eXBlIjoiSW1hZ2UifSwiY3JpdGVyaWEiOnsidHlwZSI6IkNyaXRlcmlhIiwibmFycmF0aXZlIjoiU29sdXRpb25zIHByb3ZpZGVycyBlYXJuZWQgdGhpcyBiYWRnZSBieSBkZW1vbnN0cmF0aW5nIGludGVyb3BlcmFiaWxpdHkgYmV0d2VlbiBtdWx0aXBsZSBwcm92aWRlcnMgYmFzZWQgb24gdGhlIE9CdjMgY2FuZGlkYXRlIGZpbmFsIHN0YW5kYXJkLCB3aXRoIHNvbWUgYWRkaXRpb25hbCByZXF1aXJlZCBmaWVsZHMuIENyZWRlbnRpYWwgaXNzdWVycyBlYXJuaW5nIHRoaXMgYmFkZ2Ugc3VjY2Vzc2Z1bGx5IGlzc3VlZCBhIGNyZWRlbnRpYWwgaW50byBhdCBsZWFzdCB0d28gd2FsbGV0cy4gIFdhbGxldCBpbXBsZW1lbnRlcnMgZWFybmluZyB0aGlzIGJhZGdlIHN1Y2Nlc3NmdWxseSBkaXNwbGF5ZWQgY3JlZGVudGlhbHMgaXNzdWVkIGJ5IGF0IGxlYXN0IHR3byBkaWZmZXJlbnQgY3JlZGVudGlhbCBpc3N1ZXJzLiJ9LCJkZXNjcmlwdGlvbiI6IlRoaXMgY3JlZGVudGlhbCBzb2x1dGlvbiBzdXBwb3J0cyB0aGUgdXNlIG9mIE9CdjMgYW5kIHczYyBWZXJpZmlhYmxlIENyZWRlbnRpYWxzIGFuZCBpcyBpbnRlcm9wZXJhYmxlIHdpdGggYXQgbGVhc3QgdHdvIG90aGVyIHNvbHV0aW9ucy4gIFRoaXMgd2FzIGRlbW9uc3RyYXRlZCBzdWNjZXNzZnVsbHkgZHVyaW5nIEpGRiB4IHZjLWVkdSBQbHVnRmVzdCAyLiJ9XQ~',
      type: 'EnvelopedVerifiableCredential',
    },
    {
      __proto__: W3cV2DataIntegrityVerifiableCredential.prototype,
      securedCredential: {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context.json'],
        type: ['VerifiableCredential', 'VerifiableCredentialExtension', 'OpenBadgeCredential'],
        issuer: {
          id: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InpRT293SUMxZ1dKdGRkZEI1R0F0NGxhdTZMdDhJaHk3NzFpQWZhbS0xcGMiLCJ5IjoiY2pEXzdvM2dkUTF2Z2lReTNfc01HczdXcndDTVU5RlFZaW1BM0h4bk1sdyJ9',
          name: 'Jobs for the Future (JFF)',
          iconUrl: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
          image: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
        },
        name: 'JFF x vc-edu PlugFest 2',
        description: "MATTR's submission for JFF Plugfest 2",
        credentialBranding: {
          backgroundColor: '#464c49',
        },
        validFrom: '2023-01-25T16:58:06.292Z',
        credentialSubject: {
          id: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
          type: ['AchievementSubject'],
          achievement: {
            id: 'urn:uuid:bd6d9316-f7ae-4073-a1e5-2f7f5bd22922',
            name: 'JFF x vc-edu PlugFest 2 Interoperability',
            type: ['Achievement'],
            image: {
              id: 'https://w3c-ccg.github.io/vc-ed/plugfest-2-2022/images/JFF-VC-EDU-PLUGFEST2-badge-image.png',
              type: 'Image',
            },
            criteria: {
              type: 'Criteria',
              narrative:
                'Solutions providers earned this badge by demonstrating interoperability between multiple providers based on the OBv3 candidate final standard, with some additional required fields. Credential issuers earning this badge successfully issued a credential into at least two wallets.  Wallet implementers earning this badge successfully displayed credentials issued by at least two different credential issuers.',
            },
            description:
              'This credential solution supports the use of OBv3 and w3c Verifiable Credentials and is interoperable with at least two other solutions.  This was demonstrated successfully during JFF x vc-edu PlugFest 2.',
          },
        },
        proof: {
          type: 'DataIntegrityProof',
        },
      },
    },
  ],
} as const

// Outer containers (jwt, sd-jwt, no data integrity yet)
export const mixedJwtVp = {
  __proto__: W3cV2JwtVerifiablePresentation.prototype,
  resolvedPresentation: mixedVpBaseResolvedPresentation,
} as const

export const mixedSdJwtVp = {
  __proto__: W3cV2SdJwtVerifiablePresentation.prototype,
  resolvedPresentation: mixedVpBaseResolvedPresentation,
} as const

export const mixedUnsupportedVp = {
  __proto__: W3cV2Presentation.prototype,
  resolvedPresentation: mixedVpBaseResolvedPresentation,
} as const

// Nested graph fixtures for recursive VP traversal tests.
export const mixedNestedLeafResolvedPresentation = {
  ...mixedVpBaseResolvedPresentation,
  verifiableCredential: [mixedVpBaseResolvedPresentation.verifiableCredential[0]],
}
Object.setPrototypeOf(mixedNestedLeafResolvedPresentation, Object.getPrototypeOf(mixedVpBaseResolvedPresentation))

export const mixedNestedDecodedJwtVp = {
  __proto__: W3cV2JwtVerifiablePresentation.prototype,
  resolvedPresentation: mixedNestedLeafResolvedPresentation,
} as const

export const mixedNestedVpEntry = {
  __proto__: W3cV2EnvelopedVerifiablePresentation.prototype,
  id: 'data:application/vp+jwt,placeholder',
} as const

export const mixedNestedOuterResolvedPresentation = {
  ...mixedVpBaseResolvedPresentation,
  verifiableCredential: [mixedNestedVpEntry],
}
Object.setPrototypeOf(mixedNestedOuterResolvedPresentation, Object.getPrototypeOf(mixedVpBaseResolvedPresentation))

export const mixedNestedOuterJwtVp = {
  __proto__: W3cV2JwtVerifiablePresentation.prototype,
  resolvedPresentation: mixedNestedOuterResolvedPresentation,
} as const
