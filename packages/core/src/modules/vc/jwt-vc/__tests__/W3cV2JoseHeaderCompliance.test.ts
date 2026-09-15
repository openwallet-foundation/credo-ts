import { JsonEncoder } from '../../../../utils/JsonEncoder'
import {
  CredoEs256DidJwkJwtVc as CredoEs256DidJwkJwtVcSdJwt,
  CredoEs256DidKeyJwtVp as CredoEs256DidKeyJwtVpSdJwt,
} from '../../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'
import { W3cV2SdJwtVerifiableCredential } from '../../sd-jwt-vc/W3cV2SdJwtVerifiableCredential'
import { W3cV2SdJwtVerifiablePresentation } from '../../sd-jwt-vc/W3cV2SdJwtVerifiablePresentation'
import { W3cV2JwtVerifiableCredential } from '../W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from '../W3cV2JwtVerifiablePresentation'
import {
  CredoEs256DidJwkJwtVc as CredoEs256DidJwkJwtVcJwt,
  CredoEs256DidKeyJwtVp as CredoEs256DidKeyJwtVpJwt,
} from './fixtures/credo-jwt-vc-v2'

describe('W3cV2 JOSE header and data model compliance', () => {
  test('accepts vc+jwt when typ and cty headers are absent', () => {
    // VC-JOSE-COSE specifies `typ` and `cty` as SHOULD for JOSE/SD-JWT VC/VP profiles.
    // Absence is therefore allowed; only present values must match profile.
    // See: https://www.w3.org/TR/vc-jose-cose/#securing-with-jose and
    // https://www.w3.org/TR/vc-jose-cose/#securing-with-sd-jwt
    const compact = rewriteCompactJoseHeader(CredoEs256DidJwkJwtVcJwt, (header) => {
      const { typ: _typ, cty: _cty, ...rest } = header
      return rest
    })

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vp+jwt when typ and cty headers are absent', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidKeyJwtVpJwt, (header) => {
      const { typ: _typ, cty: _cty, ...rest } = header
      return rest
    })

    expect(() => W3cV2JwtVerifiablePresentation.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+sd-jwt when typ and cty headers are absent', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidJwkJwtVcSdJwt, (header) => {
      const { typ: _typ, cty: _cty, ...rest } = header
      return rest
    })

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vp+sd-jwt when typ and cty headers are absent', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidKeyJwtVpSdJwt, (header) => {
      const { typ: _typ, cty: _cty, ...rest } = header
      return rest
    })

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).not.toThrow()
  })

  test('rejects vc+jwt when alg is none', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidJwkJwtVcJwt, (header) => ({ ...header, alg: 'none' }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).toThrow(/alg.*none/)
  })

  test('rejects vp+jwt when alg is none', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidKeyJwtVpJwt, (header) => ({ ...header, alg: 'none' }))

    expect(() => W3cV2JwtVerifiablePresentation.fromCompact(compact)).toThrow(/alg.*none/)
  })

  test('rejects vc+sd-jwt when alg is none', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidJwkJwtVcSdJwt, (header) => ({ ...header, alg: 'none' }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).toThrow(/alg.*none/)
  })

  test('rejects vp+sd-jwt when alg is none', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidKeyJwtVpSdJwt, (header) => ({ ...header, alg: 'none' }))

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).toThrow(/alg.*none/)
  })

  test('rejects vc+jwt when cty header is invalid', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidJwkJwtVcJwt, (header) => ({ ...header, cty: 'vp' }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).toThrow("correct 'cty' header")
  })

  test('rejects vp+jwt when cty header is invalid', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidKeyJwtVpJwt, (header) => ({ ...header, cty: 'vc' }))

    expect(() => W3cV2JwtVerifiablePresentation.fromCompact(compact)).toThrow("correct 'cty' header")
  })

  test('rejects vc+sd-jwt when cty header is invalid', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidJwkJwtVcSdJwt, (header) => ({ ...header, cty: 'vp' }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).toThrow("correct 'cty' header")
  })

  test('rejects vp+sd-jwt when cty header is invalid', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidKeyJwtVpSdJwt, (header) => ({ ...header, cty: 'vc' }))

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).toThrow("correct 'cty' header")
  })

  test('accepts vc+jwt when cty header is vc', () => {
    const compact = rewriteCompactJoseHeader(CredoEs256DidJwkJwtVcJwt, (header) => ({ ...header, cty: 'vc' }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vp+sd-jwt when cty header is vp', () => {
    const compact = rewriteSdJwtJoseHeader(CredoEs256DidKeyJwtVpSdJwt, (header) => ({ ...header, cty: 'vp' }))

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+jwt when JOSE header iss conflicts with payload iss (SHOULD)', () => {
    const withPayloadIss = rewriteCompactJwtPayload(CredoEs256DidJwkJwtVcJwt, (payload) => ({
      ...payload,
      iss:
        typeof payload.issuer === 'string'
          ? payload.issuer
          : typeof payload.issuer === 'object' && payload.issuer && 'id' in payload.issuer
            ? (payload.issuer.id as string)
            : 'did:example:issuer',
    }))
    const compact = rewriteCompactJoseHeader(withPayloadIss, (header) => ({
      ...header,
      iss: 'did:example:issuer-b',
    }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+sd-jwt when JOSE header iss conflicts with payload iss (SHOULD)', () => {
    const withPayloadIss = rewriteSdJwtPayload(CredoEs256DidJwkJwtVcSdJwt, (payload) => ({
      ...payload,
      iss:
        typeof payload.issuer === 'string'
          ? payload.issuer
          : typeof payload.issuer === 'object' && payload.issuer && 'id' in payload.issuer
            ? (payload.issuer.id as string)
            : 'did:example:issuer',
    }))
    const compact = rewriteSdJwtJoseHeader(withPayloadIss, (header) => ({
      ...header,
      iss: 'did:example:issuer-b',
    }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('rejects vc+jwt when payload iss conflicts with credential issuer', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidJwkJwtVcJwt, (payload) => ({
      ...payload,
      iss: 'did:example:not-the-issuer',
    }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).toThrow(/'iss' and 'issuer'/)
  })

  test('rejects vc+sd-jwt when payload iss conflicts with credential issuer', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidJwkJwtVcSdJwt, (payload) => ({
      ...payload,
      iss: 'did:example:not-the-issuer',
    }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).toThrow(/'iss' and 'issuer'/)
  })

  test('accepts vc+jwt when payload jti conflicts with credential id (SHOULD)', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidJwkJwtVcJwt, (payload) => ({
      ...payload,
      id: 'urn:cred:expected',
      jti: 'urn:cred:actual',
    }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+sd-jwt when payload jti conflicts with credential id (SHOULD)', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidJwkJwtVcSdJwt, (payload) => ({
      ...payload,
      id: 'urn:cred:expected',
      jti: 'urn:cred:actual',
    }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+jwt when payload sub conflicts with credentialSubject.id (SHOULD)', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidJwkJwtVcJwt, (payload) => ({
      ...payload,
      sub: 'did:example:not-the-subject',
    }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vc+sd-jwt when payload sub conflicts with credentialSubject.id (SHOULD)', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidJwkJwtVcSdJwt, (payload) => ({
      ...payload,
      sub: 'did:example:not-the-subject',
    }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).not.toThrow()
  })

  test('accepts vp+jwt when payload jti conflicts with presentation id (SHOULD)', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidKeyJwtVpJwt, (payload) => ({
      ...payload,
      id: 'urn:vp:expected',
      jti: 'urn:vp:actual',
    }))

    expect(() => W3cV2JwtVerifiablePresentation.fromCompact(compact)).not.toThrow()
  })

  test('accepts vp+sd-jwt when payload jti conflicts with presentation id (SHOULD)', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidKeyJwtVpSdJwt, (payload) => ({
      ...payload,
      id: 'urn:vp:expected',
      jti: 'urn:vp:actual',
    }))

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).not.toThrow()
  })

  test('rejects vc+jwt payloads that include forbidden vc claim', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidJwkJwtVcJwt, (payload) => ({ ...payload, vc: {} }))

    expect(() => W3cV2JwtVerifiableCredential.fromCompact(compact)).toThrow(/vc is forbidden/)
  })

  test('rejects vp+jwt payloads that include forbidden vp claim', () => {
    const compact = rewriteCompactJwtPayload(CredoEs256DidKeyJwtVpJwt, (payload) => ({ ...payload, vp: {} }))

    expect(() => W3cV2JwtVerifiablePresentation.fromCompact(compact)).toThrow(/vp is forbidden/)
  })

  test('rejects vc+sd-jwt payloads that include forbidden vc claim', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidJwkJwtVcSdJwt, (payload) => ({ ...payload, vc: {} }))

    expect(() => W3cV2SdJwtVerifiableCredential.fromCompact(compact)).toThrow(/vc is forbidden/)
  })

  test('rejects vp+sd-jwt payloads that include forbidden vp claim', () => {
    const compact = rewriteSdJwtPayload(CredoEs256DidKeyJwtVpSdJwt, (payload) => ({ ...payload, vp: {} }))

    expect(() => W3cV2SdJwtVerifiablePresentation.fromCompact(compact)).toThrow(/vp is forbidden/)
  })
})

function rewriteSdJwtJoseHeader(
  compactSdJwt: string,
  patchHeader: (header: Record<string, unknown>) => Record<string, unknown>
) {
  const [issuerSigned, ...disclosures] = compactSdJwt.split('~')
  if (!issuerSigned) {
    throw new Error('Invalid compact SD-JWT fixture')
  }

  const patchedIssuerSigned = rewriteCompactJoseHeader(issuerSigned, patchHeader)
  return [patchedIssuerSigned, ...disclosures].join('~')
}

function rewriteCompactJoseHeader(
  compactJwt: string,
  patchHeader: (header: Record<string, unknown>) => Record<string, unknown>
) {
  const [encodedHeader, encodedPayload, encodedSignature] = compactJwt.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid compact JWT fixture')
  }

  const header = JsonEncoder.fromBase64Url(encodedHeader) as Record<string, unknown>
  const patchedHeader = patchHeader(header)

  return `${JsonEncoder.toBase64Url(patchedHeader)}.${encodedPayload}.${encodedSignature}`
}

function rewriteCompactJwtPayload(
  compactJwt: string,
  patchPayload: (payload: Record<string, unknown>) => Record<string, unknown>
) {
  const [encodedHeader, encodedPayload, encodedSignature] = compactJwt.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid compact JWT fixture')
  }

  const payload = JsonEncoder.fromBase64Url(encodedPayload) as Record<string, unknown>
  const patchedPayload = patchPayload(payload)

  return `${encodedHeader}.${JsonEncoder.toBase64Url(patchedPayload)}.${encodedSignature}`
}

function rewriteSdJwtPayload(
  compactSdJwt: string,
  patchPayload: (payload: Record<string, unknown>) => Record<string, unknown>
) {
  const [issuerSigned, ...disclosures] = compactSdJwt.split('~')
  if (!issuerSigned) {
    throw new Error('Invalid compact SD-JWT fixture')
  }

  const patchedIssuerSigned = rewriteCompactJwtPayload(issuerSigned, patchPayload)
  return [patchedIssuerSigned, ...disclosures].join('~')
}
