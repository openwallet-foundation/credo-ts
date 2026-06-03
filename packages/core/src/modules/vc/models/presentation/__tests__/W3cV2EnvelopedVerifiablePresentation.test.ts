import { JsonTransformer } from '../../../../../utils'
import { ENVELOPED_VERIFIABLE_PRESENTATION_TYPE } from '../../../constants'
import { CredoEs256DidKeyJwtVp } from '../../../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2EnvelopedVerifiablePresentation } from '../W3cV2EnvelopedVerifiablePresentation'

describe('W3cV2EnvelopedVerifiablePresentation', () => {
  const jwtVpDataUri = `data:application/vp+jwt,${CredoEs256DidKeyJwtVp}`

  test('defaults type to EnvelopedVerifiablePresentation', () => {
    const enveloped = new W3cV2EnvelopedVerifiablePresentation({ id: jwtVpDataUri })

    expect(enveloped.type).toBe(ENVELOPED_VERIFIABLE_PRESENTATION_TYPE)
  })

  test('rejects non-presentation envelope type', () => {
    expect(() =>
      JsonTransformer.fromJSON(
        {
          '@context': 'https://www.w3.org/ns/credentials/v2',
          id: jwtVpDataUri,
          type: 'EnvelopedVerifiableCredential',
        },
        W3cV2EnvelopedVerifiablePresentation
      )
    ).toThrow(ENVELOPED_VERIFIABLE_PRESENTATION_TYPE)
  })
})
