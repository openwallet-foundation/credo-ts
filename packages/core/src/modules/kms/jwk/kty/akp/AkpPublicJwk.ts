import { KeyManagementError } from '../../../error/KeyManagementError'
import { supportedSigningAlgsForKey } from '../../alg/signing'
import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp

export class AkpPublicJwk implements PublicJwkType<Jwk> {
  public static supportedEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87']
  public static multicodecPrefix: undefined = undefined

  public multicodecPrefix: undefined = undefined
  public supportedEncryptionKeyAgreementAlgorithms = AkpPublicJwk.supportedEncryptionKeyAgreementAlgorithms

  public get supportedSignatureAlgorithms() {
    return supportedSigningAlgsForKey(this.jwk)
  }

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey(): never {
    throw new KeyManagementError('Byte public keys are not supported for AKP JWKs')
  }

  public get compressedPublicKey(): never {
    throw new KeyManagementError('Compressed public keys are not supported for AKP JWKs')
  }

  public get multicodec(): never {
    throw new KeyManagementError('Multicodec is not supported for AKP JWKs')
  }

  public static fromPublicKey(): never {
    throw new KeyManagementError('Creating AKP JWKs from byte public keys is not supported')
  }

  public static fromMulticodec(): never {
    throw new KeyManagementError('Creating AKP JWKs from multicodec is not supported')
  }
}
