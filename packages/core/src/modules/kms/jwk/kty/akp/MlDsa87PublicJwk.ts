import type { KnownJwaSignatureAlgorithm } from '../../jwa'
import { AkpPublicJwk } from './AkpPublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp & { alg: 'ML-DSA-87' }

export class MlDsa87PublicJwk extends AkpPublicJwk {
  public static override supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-87']
  declare public readonly jwk: Jwk

  public constructor(jwk: Jwk) {
    super(jwk)
  }
}
