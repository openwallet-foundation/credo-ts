import { TypedArrayEncoder } from '../../../../../utils'
import type { KnownJwaSignatureAlgorithm } from '../../jwa'
import { AkpPublicJwkBase, assertPublicKeyLength } from './AkpPublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp & { alg: 'ML-DSA-44' }

export class MlDsa44PublicJwk extends AkpPublicJwkBase<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-44']
  public static multicodecPrefix = 0x1210
  public supportedSignatureAlgorithms = MlDsa44PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = MlDsa44PublicJwk.multicodecPrefix

  public constructor(jwk: Jwk) {
    super(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    assertPublicKeyLength('ML-DSA-44', multicodec)
    return new MlDsa44PublicJwk({ kty: 'AKP', alg: 'ML-DSA-44', pub: TypedArrayEncoder.toBase64Url(multicodec) })
  }
}
