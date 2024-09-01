import { com, kotlin } from '@sphereon/kmp-mdl-mdoc'

import { Agent, getJwkFromJson, TypedArrayEncoder, X509Service } from '../../..'
import { getInMemoryAgentOptions } from '../../../../tests'
import { MdocCoseCallbackService } from '../MdocCoseCallbackService'

import {
  iso18013_5_IssuerAuthTestVector,
  iso18013_5_SignatureStructureTestVector,
  sprindFunkeTestVectorBase64Url,
  sprindFunkeX509TrustedCertificate,
} from './mdoc.fixtures'

import CoseSign1Cbor = com.sphereon.crypto.cose.CoseSign1Cbor
import CoseSignatureAlgorithm = com.sphereon.crypto.cose.CoseSignatureAlgorithm
import Jwk = com.sphereon.crypto.jose.Jwk
import IssuerSignedCbor = com.sphereon.mdoc.data.device.IssuerSignedCbor

const agent = new Agent(getInMemoryAgentOptions('mdoc-issuer-auth-test-agent', {}))

describe('mdoc-issuerauth test', (): void => {
  const coseCrypto = new MdocCoseCallbackService(agent.context)

  it('should decode and encode ISO Test Vector', async () => {
    const coseSign = CoseSign1Cbor.Static.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromHex(iso18013_5_IssuerAuthTestVector))
    )
    expect(coseSign).toBeDefined()

    expect(iso18013_5_IssuerAuthTestVector).toEqual(TypedArrayEncoder.toHex(Uint8Array.from(coseSign.cborEncode())))
    expect(iso18013_5_SignatureStructureTestVector).toEqual(
      TypedArrayEncoder.toHex(Uint8Array.from(coseSign.toSignature1Structure().cborEncode()))
    )
    expect(iso18013_5_SignatureStructureTestVector).toEqual(
      coseSign.toBeSignedJson(null, CoseSignatureAlgorithm.ES256).hexValue
    )
  })

  it('jwk to coseKeyCbor transformation and back', () => {
    const jwkJson = {
      kty: 'EC',
      kid: '11',
      crv: 'P-256',
      x: 'usWxHK2PmfnHKwXPS54m0kTcGJ90UiglWiGahtagnv8',
      y: 'IBOL-C3BttVivg-lSreASjpkttcsz-1rb7btKLv8EX4',
    }

    const jwk = Jwk.Static.fromJson(jwkJson)
    // TODO:
    // expect(jwk.toJsonObject()).toEqual(jwkJson)
    const coseKeyCbor = jwk.jwkToCoseKeyCbor()
    expect(coseKeyCbor).toBeDefined()
  })

  it('should verify IETF Test Vector', async () => {
    const ietfTestVector =
      '8443a10126a10442313154546869732069732074686520636f6e74656e742e58408eb33e4ca31d1c465ab05aac34cc6b23d58fef5c083106c4d25a91aef0b0117e2af9a291aa32e14ab834dc56ed2a223444547e01f11d3b0916e5a4c345cacb36'
    const ietfSignature =
      '8eb33e4ca31d1c465ab05aac34cc6b23d58fef5c083106c4d25a91aef0b0117e2af9a291aa32e14ab834dc56ed2a223444547e01f11d3b0916e5a4c345cacb36'

    const issuerAuth = CoseSign1Cbor.Static.cborDecode(Int8Array.from(TypedArrayEncoder.fromHex(ietfTestVector)))
    expect(TypedArrayEncoder.toHex(Uint8Array.from(issuerAuth.signature.value))).toEqual(ietfSignature)

    const publicKey = getJwkFromJson({
      kty: 'EC',
      kid: '11',
      crv: 'P-256',
      x: 'usWxHK2PmfnHKwXPS54m0kTcGJ90UiglWiGahtagnv8',
      y: 'IBOL-C3BttVivg-lSreASjpkttcsz-1rb7btKLv8EX4',
    }).key

    const verificationResult = await coseCrypto.verify1(issuerAuth, {
      opts: kotlin.collections.KtMap.fromJsMap(new Map([['publicKey', publicKey]])),
    })

    expect(verificationResult).toMatchObject({
      name: 'cose-verification',
      message: 'cose-signature successfully validated',
      critical: false,
      error: false,
    })
  })

  it('should verify sprind funke test vector', async () => {
    const _leafCertificate = TypedArrayEncoder.toBase64(TypedArrayEncoder.fromBase64(sprindFunkeX509TrustedCertificate))
    const leafCertificate = X509Service.getLeafCertificate(agent.context, { certificateChain: [_leafCertificate] })
    const publicKey = leafCertificate.publicKey

    const issuerSigned = IssuerSignedCbor.Static.cborDecode(
      Int8Array.from(TypedArrayEncoder.fromBase64(sprindFunkeTestVectorBase64Url))
    )
    await expect(
      coseCrypto.verify1(issuerSigned.issuerAuth, {
        opts: kotlin.collections.KtMap.fromJsMap(new Map([['publicKey', publicKey]])),
      })
    ).resolves.toMatchObject({
      critical: false,
      error: false,
      message: 'cose-signature successfully validated',
    })
  })
})
