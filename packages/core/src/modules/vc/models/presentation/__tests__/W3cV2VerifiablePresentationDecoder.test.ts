import { CredoError } from '../../../../../error'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { TypedArrayEncoder } from '../../../../../utils/TypedArrayEncoder'
import { W3cV2DataIntegrityVerifiablePresentation } from '../../../data-integrity-v1'
import { W3cV2JwtVerifiablePresentation } from '../../../jwt-vc'
import { CredoEs256DidKeyJwtVp } from '../../../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2SdJwtVerifiablePresentation } from '../../../sd-jwt-vc'
import { CredoEs256DidKeyJwtVp as CredoEs256DidKeySdJwtVp } from '../../../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'
import { ClaimFormat } from '../../ClaimFormat'
import { decodeW3cV2VerifiablePresentation } from '../W3cV2VerifiablePresentation'

describe('decodeW3cV2VerifiablePresentation', () => {
  test('routes JSON object payload to DI presentation decoder', () => {
    const result = decodeW3cV2VerifiablePresentation(
      '  {"@context":["https://www.w3.org/ns/credentials/v2","https://w3id.org/security/data-integrity/v2"],"type":["VerifiablePresentation"],"holder":"did:key:z6Mkholder","proof":{"type":"DataIntegrityProof"}}'
    )

    expect(result).toBeInstanceOf(W3cV2DataIntegrityVerifiablePresentation)
    expect(result.claimFormat).toBe(ClaimFormat.DiVp)
  })

  test('rejects proof-only JSON payload without VP type semantics', () => {
    expect(() =>
      decodeW3cV2VerifiablePresentation(
        '{"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential"],"proof":{"type":"DataIntegrityProof"}}'
      )
    ).toThrow(CredoError)
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

  test('rejects vc+sd-jwt compact token in VP decode path', () => {
    const compact = `${toCompactHeader({ alg: 'ES256', typ: 'vc+sd-jwt' })}~disclosure`

    expect(() => decodeW3cV2VerifiablePresentation(compact)).toThrow(
      'Value is a W3C SD-JWT VC, but a W3C SD-JWT VP was expected'
    )
  })

  test('does not fall back from malformed sd-jwt shape to jwt parsing', () => {
    expect(() => decodeW3cV2VerifiablePresentation('not-a-jwt~still-not-a-jwt')).toThrow("Expected compact 'vp+sd-jwt'")
  })

  test('rejects vc+jwt compact token in VP decode path', () => {
    const compact = toCompactHeader({ alg: 'ES256', typ: 'vc+jwt' })

    expect(() => decodeW3cV2VerifiablePresentation(compact)).toThrow(
      'Value is a W3C VC JWT, but a W3C VP JWT was expected'
    )
  })

  test('rejects vp+sd-jwt typ without sd-jwt disclosures', () => {
    const compact = toCompactHeader({ alg: 'ES256', typ: 'vp+sd-jwt' })

    expect(() => decodeW3cV2VerifiablePresentation(compact)).toThrow('missing SD-JWT disclosures')
  })

  test('rejects non-jwt compact input without sd-jwt separators', () => {
    expect(() => decodeW3cV2VerifiablePresentation('not-a-jwt')).toThrow("Expected compact 'vp+jwt'")
  })
})

function toCompactHeader(header: Record<string, unknown>) {
  const encodedHeader = JsonEncoder.toBase64Url(header)
  const encodedPayload = JsonEncoder.toBase64Url({ iss: 'did:example:holder' })
  const encodedSignature = TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String('signature'))

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}
