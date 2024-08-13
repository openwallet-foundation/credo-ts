import type { AgentContext } from '../../agent'

import { type Nullable, com } from '@sphereon/kmp-mdl-mdoc'

import { getJwkFromKey } from '../../crypto/jose/jwk/transform'
import { TypedArrayEncoder } from '../../utils/TypedArrayEncoder'

import { MdocError } from './MdocError'

type ICoseKeyCbor = com.sphereon.cbor.cose.ICoseKeyCbor
type ICoseCallbackServiceJS = com.sphereon.crypto.ICoseCryptoCallbackJS
type KeyInfo = com.sphereon.crypto.IKeyInfo<com.sphereon.cbor.cose.ICoseKeyCbor>
type CoseSign1Cbor<CborType, JsonType> = com.sphereon.cbor.cose.CoseSign1Cbor<CborType, JsonType>
type IKey = com.sphereon.cbor.cose.IKey
type IVerifySignatureResult<KeyType extends IKey> = com.sphereon.crypto.IVerifySignatureResult<KeyType>

const mdlJwk = com.sphereon.jose.jwk.Jwk

/**
 * This class can be used for Cose signing and sigature verification.
 * Either have an instance per trustedCerts and verification invocation or use a single instance and provide the trusted certs in the method argument
 *
 * The class is also registered with the low-level mDL/mdoc Kotlin Multiplatform library
 * Next to the specific function for the library it exports a more powerful version of the same verification method as well
 */
export class MdocCoseCallbackService implements ICoseCallbackServiceJS {
  public constructor(private agentContext: AgentContext) {}
  public async sign1<CborType, JsonType>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    coseCborInput: CoseSign1Cbor<CborType, JsonType>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    keyInfo: Nullable<KeyInfo>
  ): Promise<com.sphereon.cbor.cose.CoseSign1Cbor<CborType, JsonType>> {
    throw new MdocError('Method not yet implemented')
  }

  /**
   * This method is the implementation used within the mDL/Mdoc library
   */
  public async verify1<CborType, JsonType>(
    input: CoseSign1Cbor<CborType, JsonType>,
    keyInfo?: KeyInfo
  ): Promise<IVerifySignatureResult<ICoseKeyCbor>> {
    const sign1Json = input.toJson() // Let's make it a bit easier on ourselves, instead of working with CBOR
    const coseAlg = sign1Json.protectedHeader.alg
    if (!coseAlg) {
      return Promise.reject(Error('No alg protected header present'))
    }

    if (!keyInfo?.opts) throw new MdocError('Mdoc Verification Callback missing keyInfo.')
    const kid = keyInfo?.kid ?? sign1Json.protectedHeader.kid ?? sign1Json.unprotectedHeader?.kid

    const publicKey = keyInfo.opts?.asJsReadonlyMapView().get('publicKey')
    if (!publicKey) new MdocError('Mdoc Verification Callback missing publicKey Jwk.')

    const publicKeyJwk = getJwkFromKey(publicKey).toJson()
    const coseKey = mdlJwk.Companion.fromJsonObject(publicKeyJwk).jwkToCoseKeyJson()
    const recalculatedToBeSigned = input.toBeSignedJson(coseKey, coseAlg)

    const valid = await this.agentContext.wallet.verify({
      key: publicKey,
      signature: TypedArrayEncoder.fromBase64(sign1Json.signature),
      data: TypedArrayEncoder.fromHex(recalculatedToBeSigned.hexValue),
    })

    return {
      name: 'cose-verification',
      message: valid ? 'cose-signature successfully validated' : 'cose-signature could not be validated',
      keyInfo: keyInfo ?? ({ kid, key: coseKey.toCbor() } satisfies KeyInfo),
      critical: !valid,
      error: !valid,
    } satisfies IVerifySignatureResult<ICoseKeyCbor>
  }
}
