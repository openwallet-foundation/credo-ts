import type { AnyUint8Array, Uint8ArrayBuffer } from '../../../../../types'
import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicRsa } from './rsaJwk'
import { rsaPublicJwkToPublicKey, rsaPublicKeyToPublicJwk } from './rsaPublicKey'

export class RsaPublicJwk implements PublicJwkType<KmsJwkPublicRsa> {
  public static supportedEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [
    'PS256',
    'RS256',
    'RS384',
    'PS384',
    'RS512',
    'PS512',
  ]
  public static multicodecPrefix = 4613

  public multicodecPrefix = RsaPublicJwk.multicodecPrefix
  public supportedEncryptionKeyAgreementAlgorithms = RsaPublicJwk.supportedEncryptionKeyAgreementAlgorithms

  public get supportedSignatureAlgorithms() {
    const keyBits = TypedArrayEncoder.fromBase64(this.jwk.n).length * 8

    // RSA needs minimum bit lengths for each algorithm
    const minBits2048 = ['PS256', 'RS256'] satisfies KnownJwaSignatureAlgorithm[]
    const minBits3072 = [...minBits2048, 'RS384', 'PS384'] satisfies KnownJwaSignatureAlgorithm[]
    const minBits4096 = [...minBits3072, 'RS512', 'PS512'] satisfies KnownJwaSignatureAlgorithm[]

    return keyBits >= 4096 ? minBits4096 : keyBits >= 3072 ? minBits3072 : keyBits >= 2048 ? minBits2048 : []
  }

  public constructor(public readonly jwk: KmsJwkPublicRsa) {}

  public get publicKey() {
    return {
      kty: this.jwk.kty,
      ...rsaPublicJwkToPublicKey(this.jwk),
    }
  }

  /**
   * Not supported for RSA
   */
  public get compressedPublicKey() {
    return null
  }

  public get multicodec(): Uint8ArrayBuffer {
    throw new KeyManagementError('multicodec not supported for RsaPublicJwk')
  }

  public static fromPublicKey(publicKey: { modulus: AnyUint8Array; exponent: AnyUint8Array }) {
    return new RsaPublicJwk(rsaPublicKeyToPublicJwk(publicKey))
  }

  public static fromMulticodec(_multicodec: AnyUint8Array): RsaPublicJwk {
    throw new KeyManagementError('fromMulticodec not supported for RsaPublicJwk')
  }
}
