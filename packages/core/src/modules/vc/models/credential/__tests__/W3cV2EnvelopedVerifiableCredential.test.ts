import { JsonTransformer } from '../../../../../utils'
import { CREDENTIALS_CONTEXT_V2_URL, ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE } from '../../../constants'
import { CredoEs256DidJwkJwtVc } from '../../../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2EnvelopedVerifiableCredential } from '../W3cV2EnvelopedVerifiableCredential'

describe('W3cV2EnvelopedVerifiableCredential', () => {
  const jwtCredentialDataUri = `data:application/vc+jwt,${CredoEs256DidJwkJwtVc}`

  test('permits additional contexts after the mandatory VC 2.0 context', () => {
    const enveloped = JsonTransformer.fromJSON(
      {
        '@context': [CREDENTIALS_CONTEXT_V2_URL, 'https://example.org/custom/v1'],
        id: jwtCredentialDataUri,
        type: ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE,
      },
      W3cV2EnvelopedVerifiableCredential
    )

    expect(enveloped.context).toEqual([CREDENTIALS_CONTEXT_V2_URL, 'https://example.org/custom/v1'])
  })

  test('rejects an unsupported envelope MIME type', () => {
    expect(
      () =>
        new W3cV2EnvelopedVerifiableCredential({
          id: `data:application/json,${CredoEs256DidJwkJwtVc}`,
        })
    ).toThrow('Unsupported Enveloped Verifiable Credential: application/json not recognized')
  })

  test('rejects a malformed envelope data URI', () => {
    expect(
      () =>
        new W3cV2EnvelopedVerifiableCredential({
          id: 'not-a-data-uri',
        })
    ).toThrow('Invalid Enveloped Verifiable Credential: "id" is not a valid data URI')
  })

  test('rejects a non-credential envelope type', () => {
    expect(() =>
      JsonTransformer.fromJSON(
        {
          '@context': CREDENTIALS_CONTEXT_V2_URL,
          id: jwtCredentialDataUri,
          type: 'EnvelopedVerifiablePresentation',
        },
        W3cV2EnvelopedVerifiableCredential
      )
    ).toThrow(ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE)
  })
})
