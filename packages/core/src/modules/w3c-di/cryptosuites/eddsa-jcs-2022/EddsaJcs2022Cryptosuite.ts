import { Ed25519PublicJwk, type PublicJwk } from '../../../kms'
import { JcsCryptosuite, type JcsCryptosuiteKeyParameters } from '../JcsCryptosuite'

const ED25519_PARAMETERS: JcsCryptosuiteKeyParameters = {
  hashName: 'sha-256',
  signatureAlgorithm: 'EdDSA',
  signatureLength: 64,
}

/**
 * The `eddsa-jcs-2022` cryptosuite from VC Data Integrity EdDSA Cryptosuites v1.0, for Ed25519 keys.
 */
export class EddsaJcs2022Cryptosuite extends JcsCryptosuite {
  public readonly cryptosuite = 'eddsa-jcs-2022'
  protected readonly supportedKeys = 'Ed25519'

  protected getKeyParameters(publicJwk: PublicJwk) {
    return publicJwk.is(Ed25519PublicJwk) ? ED25519_PARAMETERS : undefined
  }
}
