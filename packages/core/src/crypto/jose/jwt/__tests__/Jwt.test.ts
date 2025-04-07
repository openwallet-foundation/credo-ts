import { TypedArrayEncoder } from '../../../../utils'
import { Jwt } from '../Jwt'
import { JwtPayload } from '../JwtPayload'

describe('Jwt', () => {
  test('create Jwt instance from serialized jwt', () => {
    const jwt =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZUNJNklucFJUMjkzU1VNeFoxZEtkR1JrWkVJMVIwRjBOR3hoZFRaTWREaEphSGszTnpGcFFXWmhiUzB4Y0dNaUxDSjVJam9pWTJwRVh6ZHZNMmRrVVRGMloybFJlVE5mYzAxSGN6ZFhjbmREVFZVNVJsRlphVzFCTTBoNGJrMXNkeUo5IzAifQ.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vcHVybC5pbXNnbG9iYWwub3JnL3NwZWMvb2IvdjNwMC9jb250ZXh0Lmpzb24iXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIlZlcmlmaWFibGVDcmVkZW50aWFsRXh0ZW5zaW9uIiwiT3BlbkJhZGdlQ3JlZGVudGlhbCJdLCJpc3N1ZXIiOnsibmFtZSI6IkpvYnMgZm9yIHRoZSBGdXR1cmUgKEpGRikiLCJpY29uVXJsIjoiaHR0cHM6Ly93M2MtY2NnLmdpdGh1Yi5pby92Yy1lZC9wbHVnZmVzdC0xLTIwMjIvaW1hZ2VzL0pGRl9Mb2dvTG9ja3VwLnBuZyIsImltYWdlIjoiaHR0cHM6Ly93M2MtY2NnLmdpdGh1Yi5pby92Yy1lZC9wbHVnZmVzdC0xLTIwMjIvaW1hZ2VzL0pGRl9Mb2dvTG9ja3VwLnBuZyJ9LCJuYW1lIjoiSkZGIHggdmMtZWR1IFBsdWdGZXN0IDIiLCJkZXNjcmlwdGlvbiI6Ik1BVFRSJ3Mgc3VibWlzc2lvbiBmb3IgSkZGIFBsdWdmZXN0IDIiLCJjcmVkZW50aWFsQnJhbmRpbmciOnsiYmFja2dyb3VuZENvbG9yIjoiIzQ2NGM0OSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJ0eXBlIjpbIkFjaGlldmVtZW50U3ViamVjdCJdLCJhY2hpZXZlbWVudCI6eyJpZCI6InVybjp1dWlkOmJkNmQ5MzE2LWY3YWUtNDA3My1hMWU1LTJmN2Y1YmQyMjkyMiIsIm5hbWUiOiJKRkYgeCB2Yy1lZHUgUGx1Z0Zlc3QgMiBJbnRlcm9wZXJhYmlsaXR5IiwidHlwZSI6WyJBY2hpZXZlbWVudCJdLCJpbWFnZSI6eyJpZCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMi0yMDIyL2ltYWdlcy9KRkYtVkMtRURVLVBMVUdGRVNUMi1iYWRnZS1pbWFnZS5wbmciLCJ0eXBlIjoiSW1hZ2UifSwiY3JpdGVyaWEiOnsidHlwZSI6IkNyaXRlcmlhIiwibmFycmF0aXZlIjoiU29sdXRpb25zIHByb3ZpZGVycyBlYXJuZWQgdGhpcyBiYWRnZSBieSBkZW1vbnN0cmF0aW5nIGludGVyb3BlcmFiaWxpdHkgYmV0d2VlbiBtdWx0aXBsZSBwcm92aWRlcnMgYmFzZWQgb24gdGhlIE9CdjMgY2FuZGlkYXRlIGZpbmFsIHN0YW5kYXJkLCB3aXRoIHNvbWUgYWRkaXRpb25hbCByZXF1aXJlZCBmaWVsZHMuIENyZWRlbnRpYWwgaXNzdWVycyBlYXJuaW5nIHRoaXMgYmFkZ2Ugc3VjY2Vzc2Z1bGx5IGlzc3VlZCBhIGNyZWRlbnRpYWwgaW50byBhdCBsZWFzdCB0d28gd2FsbGV0cy4gIFdhbGxldCBpbXBsZW1lbnRlcnMgZWFybmluZyB0aGlzIGJhZGdlIHN1Y2Nlc3NmdWxseSBkaXNwbGF5ZWQgY3JlZGVudGlhbHMgaXNzdWVkIGJ5IGF0IGxlYXN0IHR3byBkaWZmZXJlbnQgY3JlZGVudGlhbCBpc3N1ZXJzLiJ9LCJkZXNjcmlwdGlvbiI6IlRoaXMgY3JlZGVudGlhbCBzb2x1dGlvbiBzdXBwb3J0cyB0aGUgdXNlIG9mIE9CdjMgYW5kIHczYyBWZXJpZmlhYmxlIENyZWRlbnRpYWxzIGFuZCBpcyBpbnRlcm9wZXJhYmxlIHdpdGggYXQgbGVhc3QgdHdvIG90aGVyIHNvbHV0aW9ucy4gIFRoaXMgd2FzIGRlbW9uc3RyYXRlZCBzdWNjZXNzZnVsbHkgZHVyaW5nIEpGRiB4IHZjLWVkdSBQbHVnRmVzdCAyLiJ9fX0sImlzcyI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpGUXlJc0ltTnlkaUk2SWxBdE1qVTJJaXdpZUNJNklucFJUMjkzU1VNeFoxZEtkR1JrWkVJMVIwRjBOR3hoZFRaTWREaEphSGszTnpGcFFXWmhiUzB4Y0dNaUxDSjVJam9pWTJwRVh6ZHZNMmRrVVRGMloybFJlVE5mYzAxSGN6ZFhjbmREVFZVNVJsRlphVzFCTTBoNGJrMXNkeUo5Iiwic3ViIjoiZGlkOmtleTp6Nk1rcWdrTHJSeUxnNmJxazI3ZGp3YmJhUVdnYVNZZ0ZWQ0txOVlLeFpiTmtwVnYiLCJuYmYiOjE2NzQ2NjU4ODZ9.anABxv424eMpp0xgbTx6aZvZxblkSThq-XbgixhWegFCVz2Q-EtRUiGJuOUjmql5TttTZ_YgtN9PgozOfuTZtg'

    const jwtInstance = Jwt.fromSerializedJwt(jwt)

    expect(jwtInstance.header).toEqual({
      alg: 'ES256',
      kid: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InpRT293SUMxZ1dKdGRkZEI1R0F0NGxhdTZMdDhJaHk3NzFpQWZhbS0xcGMiLCJ5IjoiY2pEXzdvM2dkUTF2Z2lReTNfc01HczdXcndDTVU5RlFZaW1BM0h4bk1sdyJ9#0',
      typ: 'JWT',
    })

    expect(jwtInstance.payload).toBeInstanceOf(JwtPayload)
    expect(jwtInstance.payload.toJson()).toEqual({
      aud: undefined,
      exp: undefined,
      iat: undefined,
      iss: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InpRT293SUMxZ1dKdGRkZEI1R0F0NGxhdTZMdDhJaHk3NzFpQWZhbS0xcGMiLCJ5IjoiY2pEXzdvM2dkUTF2Z2lReTNfc01HczdXcndDTVU5RlFZaW1BM0h4bk1sdyJ9',
      jti: undefined,
      nbf: 1674665886,
      sub: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://purl.imsglobal.org/spec/ob/v3p0/context.json'],
        credentialBranding: {
          backgroundColor: '#464c49',
        },
        credentialSubject: {
          achievement: {
            criteria: {
              narrative:
                'Solutions providers earned this badge by demonstrating interoperability between multiple providers based on the OBv3 candidate final standard, with some additional required fields. Credential issuers earning this badge successfully issued a credential into at least two wallets.  Wallet implementers earning this badge successfully displayed credentials issued by at least two different credential issuers.',
              type: 'Criteria',
            },
            description:
              'This credential solution supports the use of OBv3 and w3c Verifiable Credentials and is interoperable with at least two other solutions.  This was demonstrated successfully during JFF x vc-edu PlugFest 2.',
            id: 'urn:uuid:bd6d9316-f7ae-4073-a1e5-2f7f5bd22922',
            image: {
              id: 'https://w3c-ccg.github.io/vc-ed/plugfest-2-2022/images/JFF-VC-EDU-PLUGFEST2-badge-image.png',
              type: 'Image',
            },
            name: 'JFF x vc-edu PlugFest 2 Interoperability',
            type: ['Achievement'],
          },
          type: ['AchievementSubject'],
        },
        description: "MATTR's submission for JFF Plugfest 2",
        issuer: {
          iconUrl: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
          image: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
          name: 'Jobs for the Future (JFF)',
        },
        name: 'JFF x vc-edu PlugFest 2',
        type: ['VerifiableCredential', 'VerifiableCredentialExtension', 'OpenBadgeCredential'],
      },
    })

    expect(
      jwtInstance.signature.equals(
        TypedArrayEncoder.fromBase64(
          'anABxv424eMpp0xgbTx6aZvZxblkSThq-XbgixhWegFCVz2Q-EtRUiGJuOUjmql5TttTZ_YgtN9PgozOfuTZtg'
        )
      )
    ).toBe(true)
  })
})
