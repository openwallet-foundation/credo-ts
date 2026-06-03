import { CredoError } from '../../../../../error'
import { W3cV2DataIntegrityVerifiablePresentation } from '../../../data-integrity-v1'
import { W3cV2JwtVerifiablePresentation } from '../../../jwt-vc'
import { CredoEs256DidKeyJwtVp } from '../../../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2SdJwtVerifiablePresentation } from '../../../sd-jwt-vc'
import { CredoEs256DidKeyJwtVp as CredoEs256DidKeySdJwtVp } from '../../../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'
import { decodeW3cV2VerifiablePresentation } from '../W3cV2VerifiablePresentation'

describe('decodeW3cV2VerifiablePresentation', () => {
  test('routes JSON object payload to DI presentation decoder', () => {
    const diSpy = vi
      .spyOn(W3cV2DataIntegrityVerifiablePresentation, 'fromObject')
      .mockReturnValue({ claimFormat: 'di_vp' } as never)

    const result = decodeW3cV2VerifiablePresentation('  {"proof":{"type":"DataIntegrityProof"}}')

    expect(diSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ claimFormat: 'di_vp' })
  })

  test('accepts envelope-first vp+jwt data URI encoding', () => {
    const result = decodeW3cV2VerifiablePresentation(`data:application/vp+jwt,${CredoEs256DidKeyJwtVp}`)

    expect(result).toBeInstanceOf(W3cV2JwtVerifiablePresentation)
  })

  test('accepts envelope-first vp+sd-jwt data URI encoding', () => {
    const result = decodeW3cV2VerifiablePresentation(`data:application/vp+sd-jwt,${CredoEs256DidKeySdJwtVp}`)

    expect(result).toBeInstanceOf(W3cV2SdJwtVerifiablePresentation)
  })

  test('rejects unsupported data URI encoding for presentation', () => {
    expect(() => decodeW3cV2VerifiablePresentation('data:application/vp+cose,ZmFrZQ')).toThrow(CredoError)
  })
})
