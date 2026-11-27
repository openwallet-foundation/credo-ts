import type { KnownJwaSignatureAlgorithm } from '../../jwa'
import { AkpPublicJwk } from './AkpPublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp & { alg: 'ML-DSA-44' }

export class MlDsa44PublicJwk extends AkpPublicJwk {
  public static override supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-44']
  declare public readonly jwk: Jwk

  public constructor(jwk: Jwk) {
    super(jwk)
  }
}
