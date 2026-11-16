import { P256PublicJwk, P384PublicJwk, type PublicJwk } from '../../../kms'
import { JcsCryptosuite, type JcsCryptosuiteKeyParameters } from '../JcsCryptosuite'

const P256_PARAMETERS: JcsCryptosuiteKeyParameters = {
  hashName: 'sha-256',
  signatureAlgorithm: 'ES256',
  signatureLength: 64,
}
const P384_PARAMETERS: JcsCryptosuiteKeyParameters = {
  hashName: 'sha-384',
  signatureAlgorithm: 'ES384',
  signatureLength: 96,
}

/**
 * The `ecdsa-jcs-2019` cryptosuite from VC Data Integrity ECDSA Cryptosuites v1.0, for P-256 and P-384 keys.
 *
 * The curve of the key selects the hash, the signature algorithm and the signature length.
 */
export class EcdsaJcs2019Cryptosuite extends JcsCryptosuite {
  public readonly cryptosuite = 'ecdsa-jcs-2019'
  protected readonly supportedKeys = 'P-256 and P-384'

  protected getKeyParameters(publicJwk: PublicJwk) {
    if (publicJwk.is(P256PublicJwk)) return P256_PARAMETERS
    if (publicJwk.is(P384PublicJwk)) return P384_PARAMETERS
    return undefined
  }
}
