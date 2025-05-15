import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../../jwa'
import { PublicJwkType } from '../PublicJwk'
import { KmsJwkPublicRsa } from './rsaJwk'
import { rsaPublicJwkToPublicKey, rsaPublicKeyToPublicJwk } from './rsaPublicKey'

export class RsaPublicJwk implements PublicJwkType<KmsJwkPublicRsa> {
  public static supportdEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
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
  public supportdEncryptionKeyAgreementAlgorithms = RsaPublicJwk.supportdEncryptionKeyAgreementAlgorithms

  public get supportedSignatureAlgorithms() {
    const keyBits = TypedArrayEncoder.fromBase64(this.jwk.n).length * 8

    // RSA needs minimum bit lengths for each algorithm
    const minBits2048: KnownJwaSignatureAlgorithm[] = ['PS256', 'RS256']
    const minBits3072: KnownJwaSignatureAlgorithm[] = [...minBits2048, 'RS384', 'PS384']
    const minBits4096: KnownJwaSignatureAlgorithm[] = [...minBits3072, 'RS512', 'PS512']

    return keyBits >= 4096 ? minBits4096 : keyBits >= 3072 ? minBits3072 : keyBits >= 2048 ? minBits2048 : []
  }

  public constructor(public readonly jwk: KmsJwkPublicRsa) {}

  public get publicKey() {
    return {
      kty: this.jwk.kty,
      ...rsaPublicJwkToPublicKey(this.jwk),
    }
  }

  public get multicodec(): Uint8Array {
    throw new KeyManagementError('multicodec not supported for RsaPublicJwk')
  }

  public static fromPublicKey(publicKey: { modulus: Uint8Array; exponent: Uint8Array }) {
    return new RsaPublicJwk(rsaPublicKeyToPublicJwk(publicKey))
  }

  public static fromMulticodec(_multicodec: Uint8Array): RsaPublicJwk {
    throw new KeyManagementError('fromMulticodec not supported for RsaPublicJwk')
  }
}
