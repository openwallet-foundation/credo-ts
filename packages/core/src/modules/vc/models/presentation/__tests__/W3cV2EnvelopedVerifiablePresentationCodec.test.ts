import { CredoError } from '../../../../../error'
import { W3cV2JwtVerifiablePresentation } from '../../../jwt-vc'
import { CredoEs256DidKeyJwtVp } from '../../../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2SdJwtVerifiablePresentation } from '../../../sd-jwt-vc'
import { CredoEs256DidKeyJwtVp as CredoEs256DidKeySdJwtVp } from '../../../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'
import { presentationFromDataUri, presentationToDataUri } from '../W3cV2EnvelopedVerifiablePresentationCodec'

describe('W3cV2EnvelopedVerifiablePresentationCodec', () => {
  test('decodes vp+jwt data URI', () => {
    const result = presentationFromDataUri(`data:application/vp+jwt,${CredoEs256DidKeyJwtVp}`)

    expect(result).toBeInstanceOf(W3cV2JwtVerifiablePresentation)
  })

  test('decodes vp+sd-jwt data URI', () => {
    const result = presentationFromDataUri(`data:application/vp+sd-jwt,${CredoEs256DidKeySdJwtVp}`)

    expect(result).toBeInstanceOf(W3cV2SdJwtVerifiablePresentation)
  })

  test('throws deterministic error for malformed URI', () => {
    expect(() => presentationFromDataUri('data:application/vp+jwt')).toThrow('data URI is missing comma separator')
  })

  test('throws deterministic error for unsupported mimetype', () => {
    expect(() => presentationFromDataUri('data:application/vp+cose,ZmFrZQ')).toThrow(CredoError)
  })

  test('encodes vp+jwt to data URI', () => {
    const vp = W3cV2JwtVerifiablePresentation.fromCompact(CredoEs256DidKeyJwtVp)

    expect(presentationToDataUri(vp)).toBe(`data:application/vp+jwt,${CredoEs256DidKeyJwtVp}`)
  })
})
