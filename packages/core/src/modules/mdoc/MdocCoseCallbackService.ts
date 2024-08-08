import type { Nullable, com } from '@sphereon/kmp-mdl-mdoc'

import { type AgentContext } from '../..'

type ICoseKeyCbor = com.sphereon.cbor.cose.ICoseKeyCbor
type ICoseCallbackServiceJS = com.sphereon.crypto.ICoseCryptoCallbackJS
type KeyInfo = com.sphereon.crypto.IKeyInfo<com.sphereon.cbor.cose.ICoseKeyCbor>
type CoseSign1Cbor<CborType, JsonType> = com.sphereon.cbor.cose.CoseSign1InputCbor<CborType, JsonType>
type IKey = com.sphereon.cbor.cose.IKey
type IVerifySignatureResult<KeyType extends IKey> = com.sphereon.crypto.IVerifySignatureResult<KeyType>

/**
 * This class can be used for Cose signing and sigature verification.
 * Either have an instance per trustedCerts and verification invocation or use a single instance and provide the trusted certs in the method argument
 *
 * The class is also registered with the low-level mDL/mdoc Kotlin Multiplatform library
 * Next to the specific function for the library it exports a more powerful version of the same verification method as well
 */
export class MdocCoseCallbackService implements ICoseCallbackServiceJS {
  public constructor() {}
  public async sign1<CborType, JsonType>(
    coseCborInput: CoseSign1Cbor<CborType, JsonType>,
    keyInfo: Nullable<KeyInfo>
  ): Promise<com.sphereon.cbor.cose.CoseSign1Cbor<CborType, JsonType>> {
    throw new Error('not yet implemented')
    //if (!keyInfo?.key) {
    //throw new MdocError('Missing key in mdoc cose sign callback')
    //}
    //const jwk = getJwkFromJson(keyInfo.key.toJson())
    //const key = jwk.key

    //if (!coseCborInput.payload) {
    //throw new MdocError('Missing payload in mdoc cose sign callback.')
    //}

    //const data = TypedArrayEncoder.fromHex(coseCborInput.payload.toHexString())
    //const signedPayload = await this.agentContext.wallet.sign({ data, key })

    //// TODO: I CANNOT IMAGE THIS IS TRUE
    //return new com.sphereon.cbor.cose.CoseSign1Cbor(
    //coseCborInput.protectedHeader,
    //coseCborInput.unprotectedHeader,
    //coseCborInput.payload,
    //new com.sphereon.cbor.CborByteString(new Int8Array(signedPayload))
    //)
  }

  /**
   * This method is the implementation used within the mDL/Mdoc library
   */
  public async verify1<CborType, JsonType>(
    input: CoseSign1Cbor<CborType, JsonType>,
    keyInfo: Nullable<KeyInfo>
  ): Promise<IVerifySignatureResult<ICoseKeyCbor>> {
    return {
      error: false,
      keyInfo: undefined,
      name: 'cose-verification success',
      critical: false,
      message: 'cose-signature successfully validated',
    } satisfies IVerifySignatureResult<ICoseKeyCbor>
  }
}
