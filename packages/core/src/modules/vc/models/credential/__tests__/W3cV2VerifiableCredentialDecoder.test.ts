import { CredoError } from '../../../../../error'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { TypedArrayEncoder } from '../../../../../utils/TypedArrayEncoder'
import { W3cV2DataIntegrityVerifiableCredential } from '../../../data-integrity-v1'
import { W3cV2JwtVerifiableCredential } from '../../../jwt-vc'
import { W3cV2SdJwtVerifiableCredential } from '../../../sd-jwt-vc'
import { ClaimFormat } from '../../ClaimFormat'
import { decodeW3cV2VerifiableCredential } from '../W3cV2VerifiableCredential'

describe('decodeW3cV2VerifiableCredential', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('routes JSON object payload to DI credential decoder', () => {
    const result = decodeW3cV2VerifiableCredential(
      '   {"@context":["https://www.w3.org/ns/credentials/v2","https://w3id.org/security/data-integrity/v2"],"type":["VerifiableCredential"],"issuer":"did:key:z6Mkissuer","credentialSubject":{"id":"did:key:z6Mksubject"},"proof":{"type":"DataIntegrityProof"}}'
    )

    expect(result).toBeInstanceOf(W3cV2DataIntegrityVerifiableCredential)
    expect(result.claimFormat).toBe(ClaimFormat.DiVc)
  })

  test('routes compact with vc+sd-jwt typ to SD-JWT VC decoder', () => {
    const sdSpy = vi.spyOn(W3cV2SdJwtVerifiableCredential, 'fromCompact').mockReturnValue({} as never)
    const jwtSpy = vi.spyOn(W3cV2JwtVerifiableCredential, 'fromCompact').mockReturnValue({} as never)

    const compact = `${toCompactHeader({ alg: 'ES256', typ: 'vc+sd-jwt' })}~disclosure`

    decodeW3cV2VerifiableCredential(compact)

    expect(sdSpy).toHaveBeenCalledTimes(1)
    expect(jwtSpy).not.toHaveBeenCalled()
  })

  test('does not treat arbitrary tilde strings as SD-JWT VC', () => {
    const sdSpy = vi.spyOn(W3cV2SdJwtVerifiableCredential, 'fromCompact').mockReturnValue({} as never)

    expect(() => decodeW3cV2VerifiableCredential('not-a-jwt~still-not-a-jwt')).toThrow(CredoError)
    expect(sdSpy).not.toHaveBeenCalled()
  })

  test('rejects vp+sd-jwt compact token in VC decode path', () => {
    const sdSpy = vi.spyOn(W3cV2SdJwtVerifiableCredential, 'fromCompact').mockReturnValue({} as never)

    const compact = `${toCompactHeader({ alg: 'ES256', typ: 'vp+sd-jwt' })}~disclosure`

    expect(() => decodeW3cV2VerifiableCredential(compact)).toThrow(
      'Value is a W3C SD-JWT VP, but a W3C SD-JWT VC was expected'
    )
    expect(sdSpy).not.toHaveBeenCalled()
  })
})

function toCompactHeader(header: Record<string, unknown>) {
  const encodedHeader = JsonEncoder.toBase64Url(header)
  const encodedPayload = JsonEncoder.toBase64Url({ iss: 'did:example:issuer' })
  const encodedSignature = TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String('signature'))

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}
