import { TypedArrayEncoder } from '../../../../../utils'
import type { KnownJwaSignatureAlgorithm } from '../../jwa'
import { AkpPublicJwkBase, assertPublicKeyLength } from './AkpPublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp & { alg: 'ML-DSA-87' }

export class MlDsa87PublicJwk extends AkpPublicJwkBase<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-87']
  public static multicodecPrefix = 0x1212
  public supportedSignatureAlgorithms = MlDsa87PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = MlDsa87PublicJwk.multicodecPrefix

  public constructor(jwk: Jwk) {
    super(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    assertPublicKeyLength('ML-DSA-87', multicodec)
    return new MlDsa87PublicJwk({ kty: 'AKP', alg: 'ML-DSA-87', pub: TypedArrayEncoder.toBase64Url(multicodec) })
  }
}
