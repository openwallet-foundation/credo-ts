import { TypedArrayEncoder } from '../../../../../utils'
import type { KnownJwaSignatureAlgorithm } from '../../jwa'
import { AkpPublicJwkBase, assertPublicKeyLength } from './AkpPublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp & { alg: 'ML-DSA-65' }

export class MlDsa65PublicJwk extends AkpPublicJwkBase<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-65']
  public static multicodecPrefix = 0x1211
  public supportedSignatureAlgorithms = MlDsa65PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = MlDsa65PublicJwk.multicodecPrefix

  public constructor(jwk: Jwk) {
    super(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    assertPublicKeyLength('ML-DSA-65', multicodec)
    return new MlDsa65PublicJwk({ kty: 'AKP', alg: 'ML-DSA-65', pub: TypedArrayEncoder.toBase64Url(multicodec) })
  }
}
