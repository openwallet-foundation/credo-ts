import { type PublicJwk } from '../../../kms'
import { MlDsa44PublicJwk } from '../../../kms/jwk/kty/akp/MlDsa44PublicJwk'
import { JcsCryptosuite, type JcsCryptosuiteKeyParameters } from '../JcsCryptosuite'

const ML_DSA_44_PARAMETERS: JcsCryptosuiteKeyParameters = {
  hashName: 'sha-256',
  signatureAlgorithm: 'ML-DSA-44',
  signatureLength: 2420,
}

export class Mldsa44Jcs2024Cryptosuite extends JcsCryptosuite {
  public readonly cryptosuite = 'mldsa44-jcs-2024'
  protected readonly supportedKeys = 'ML-DSA-44'
  protected readonly proofValueMultibase = 'base64url'

  protected getKeyParameters(publicJwk: PublicJwk) {
    return publicJwk.is(MlDsa44PublicJwk) ? ML_DSA_44_PARAMETERS : undefined
  }
}
